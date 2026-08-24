import { and, asc, eq, inArray, isNull, like, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '../../db/cliente.js';
import {
  comandas,
  cuentaLineas,
  cuentas,
  zonas,
  lineaModificadores,
  mesas,
  modificadores,
  ordenLineas,
  ordenes,
  productos,
  usuarios,
  variantes,
} from '../../db/esquema.js';
import { conflicto, invalido, noEncontrado } from '../../http/errores.js';
import { autorizar, registrar } from '../auth/auth.servicio.js';
import { totalLinea } from '../dinero.js';
import type * as E from './ordenes.esquemas.js';

type OrdenNueva = z.infer<typeof E.ordenNueva>;
type LineasNuevas = z.infer<typeof E.lineasNuevas>;
type LineaCambio = z.infer<typeof E.lineaCambio>;
type Cancelacion = z.infer<typeof E.cancelacionLinea>;

/* ── Apertura y consulta ─────────────────────────────────────────────── */

export function ordenAbiertaDeMesa(mesaId: number) {
  return db
    .select()
    .from(ordenes)
    .where(and(eq(ordenes.mesaId, mesaId), eq(ordenes.estado, 'abierta')))
    .get();
}

export function abrirOrden(datos: OrdenNueva, meseroId: number) {
  return db.transaction((tx) => {
    const mesa = tx.select().from(mesas).where(eq(mesas.id, datos.mesaId)).get();
    if (!mesa) throw noEncontrado('Mesa');
    if (!mesa.activa) throw conflicto('Esa mesa está desactivada');
    if (ordenAbiertaDeMesa(datos.mesaId)) throw conflicto('La mesa ya tiene una orden abierta');

    const folio = (tx.select({ n: sql<number>`coalesce(max(folio), 0) + 1` }).from(ordenes).get()?.n ?? 1);
    const orden = tx
      .insert(ordenes)
      .values({ folio, mesaId: datos.mesaId, meseroId, comensales: datos.comensales })
      .returning()
      .get();

    // Toda orden nace con una cuenta: dividir es la excepción, no la regla.
    tx.insert(cuentas).values({ ordenId: orden.id, nombre: 'Cuenta 1' }).run();
    tx.update(mesas).set({ estado: 'ocupada' }).where(eq(mesas.id, datos.mesaId)).run();
    return orden;
  });
}

/** La orden completa: líneas con sus modificadores, cuentas y totales por línea. */
export function obtenerOrden(id: number) {
  const orden = db
    .select({
      id: ordenes.id,
      folio: ordenes.folio,
      mesaId: ordenes.mesaId,
      mesaNombre: mesas.nombre,
      meseroId: ordenes.meseroId,
      meseroNombre: usuarios.nombre,
      comensales: ordenes.comensales,
      estado: ordenes.estado,
      abiertaEn: ordenes.abiertaEn,
      cerradaEn: ordenes.cerradaEn,
    })
    .from(ordenes)
    .innerJoin(mesas, eq(mesas.id, ordenes.mesaId))
    .innerJoin(usuarios, eq(usuarios.id, ordenes.meseroId))
    .where(eq(ordenes.id, id))
    .get();
  if (!orden) throw noEncontrado('Orden');

  const lineas = lineasDeOrden(id);
  const asignaciones = db
    .select()
    .from(cuentaLineas)
    .innerJoin(cuentas, eq(cuentas.id, cuentaLineas.cuentaId))
    .where(eq(cuentas.ordenId, id))
    .all()
    .map((f) => f.cuenta_lineas);

  return {
    ...orden,
    lineas: lineas.map((l) => ({
      ...l,
      cuentaIds: asignaciones.filter((a) => a.lineaId === l.id).map((a) => a.cuentaId),
    })),
    cuentas: db.select().from(cuentas).where(eq(cuentas.ordenId, id)).orderBy(asc(cuentas.id)).all(),
  };
}

/** Líneas con modificadores y total ya calculado. Base de cuentas y tickets. */
export function lineasDeOrden(ordenId: number) {
  const lineas = db.select().from(ordenLineas).where(eq(ordenLineas.ordenId, ordenId)).orderBy(asc(ordenLineas.id)).all();
  if (lineas.length === 0) return [];

  const mods = db
    .select()
    .from(lineaModificadores)
    .where(inArray(lineaModificadores.lineaId, lineas.map((l) => l.id)))
    .all();

  return lineas.map((linea) => {
    const suyos = mods.filter((m) => m.lineaId === linea.id);
    const extras = suyos.reduce((a, m) => a + m.precioExtraCentavos, 0);
    return {
      ...linea,
      modificadores: suyos,
      extrasCentavos: extras,
      totalCentavos:
        linea.estado === 'cancelada' || linea.esCortesia
          ? 0
          : totalLinea(linea.precioUnitarioCentavos, extras, linea.cantidadMilesimas),
    };
  });
}

/* ── Captura ─────────────────────────────────────────────────────────── */

export function agregarLineas(ordenId: number, datos: LineasNuevas) {
  return db.transaction((tx) => {
    const orden = tx.select().from(ordenes).where(eq(ordenes.id, ordenId)).get();
    if (!orden) throw noEncontrado('Orden');
    if (orden.estado !== 'abierta') throw conflicto('La orden ya está cerrada');

    const cuenta = cuentaDestino(tx, ordenId, datos.cuentaId);

    for (const entrada of datos.lineas) {
      const info = tx
        .select({ variante: variantes, producto: productos })
        .from(variantes)
        .innerJoin(productos, eq(productos.id, variantes.productoId))
        .where(eq(variantes.id, entrada.varianteId))
        .get();
      if (!info) throw noEncontrado('Producto');
      const { variante, producto } = info;

      if (!producto.activo) throw conflicto(`${producto.nombre} ya no está en el menú`);
      if (!producto.disponibleHoy) throw conflicto(`${producto.nombre} está agotado hoy`);

      // El precio abierto ("precio del día") se captura al vender; los demás se
      // congelan desde el catálogo para que la cuenta no cambie sola.
      const precio =
        producto.tipoVenta === 'abierto'
          ? entrada.precioCentavos ?? invalidarPrecio(producto.nombre)
          : variante.precioCentavos;

      const linea = tx
        .insert(ordenLineas)
        .values({
          ordenId,
          productoId: producto.id,
          varianteId: variante.id,
          productoNombre: producto.nombre,
          varianteNombre: producto.tipoVenta === 'variantes' ? variante.nombre : '',
          estacion: producto.estacion,
          unidad: producto.unidad,
          precioUnitarioCentavos: precio,
          cantidadMilesimas: entrada.cantidadMilesimas,
          nota: entrada.nota,
        })
        .returning()
        .get();

      if (entrada.modificadoresIds.length) {
        const elegidos = tx.select().from(modificadores).where(inArray(modificadores.id, entrada.modificadoresIds)).all();
        for (const m of elegidos) {
          tx.insert(lineaModificadores)
            .values({ lineaId: linea.id, modificadorId: m.id, nombre: m.nombre, precioExtraCentavos: m.precioExtraCentavos })
            .run();
        }
      }

      tx.insert(cuentaLineas).values({ cuentaId: cuenta.id, lineaId: linea.id }).run();
    }

    return obtenerOrden(ordenId);
  });
}

function invalidarPrecio(nombre: string): never {
  throw invalido(`${nombre} se vende a precio del día: hay que capturar el precio`);
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function cuentaDestino(tx: Tx, ordenId: number, cuentaId?: number) {
  const cuenta = cuentaId
    ? tx.select().from(cuentas).where(and(eq(cuentas.id, cuentaId), eq(cuentas.ordenId, ordenId))).get()
    : tx.select().from(cuentas).where(and(eq(cuentas.ordenId, ordenId), eq(cuentas.estado, 'abierta'))).orderBy(asc(cuentas.id)).get();
  if (!cuenta) throw noEncontrado('Cuenta');
  if (cuenta.estado !== 'abierta') throw conflicto('Esa cuenta ya fue cobrada');
  return cuenta;
}

export function actualizarLinea(lineaId: number, cambios: LineaCambio) {
  const linea = db.select().from(ordenLineas).where(eq(ordenLineas.id, lineaId)).get();
  if (!linea) throw noEncontrado('Línea');
  if (linea.estado !== 'pendiente') {
    throw conflicto('Ese platillo ya se envió a cocina. Cancélalo con autorización si es necesario.');
  }
  if (!Object.keys(cambios).length) return linea;
  return db.update(ordenLineas).set(cambios).where(eq(ordenLineas.id, lineaId)).returning().get();
}

export function eliminarLinea(lineaId: number) {
  const linea = db.select().from(ordenLineas).where(eq(ordenLineas.id, lineaId)).get();
  if (!linea) throw noEncontrado('Línea');
  if (linea.estado !== 'pendiente') {
    throw conflicto('Ese platillo ya se envió a cocina. Cancélalo con autorización.');
  }
  return db.delete(ordenLineas).where(eq(ordenLineas.id, lineaId)).returning().get();
}

/* ── Comandas ────────────────────────────────────────────────────────── */

/** Envía lo pendiente a cocina y barra. Idempotente: si el Wi-Fi hace reintentar,
 *  la comanda no se duplica. */
export function enviarComanda(ordenId: number, claveIdempotencia?: string) {
  if (claveIdempotencia) {
    // Un envío puede generar una comanda por estación, así que la clave se guarda
    // como "clave:estacion". El reintento busca por prefijo, no por igualdad.
    const previas = db.select().from(comandas).where(like(comandas.claveIdempotencia, `${claveIdempotencia}:%`)).all();
    if (previas.length) return { comandas: previas, repetida: true };
  }

  return db.transaction((tx) => {
    const orden = tx.select().from(ordenes).where(eq(ordenes.id, ordenId)).get();
    if (!orden) throw noEncontrado('Orden');
    if (orden.estado !== 'abierta') throw conflicto('La orden ya está cerrada');

    const pendientes = tx
      .select()
      .from(ordenLineas)
      .where(and(eq(ordenLineas.ordenId, ordenId), eq(ordenLineas.estado, 'pendiente')))
      .all();
    if (pendientes.length === 0) throw conflicto('No hay nada pendiente por enviar');

    const creadas = [];
    for (const estacion of ['cocina', 'barra'] as const) {
      const suyas = pendientes.filter((l) => l.estacion === estacion);
      if (!suyas.length) continue;

      const comanda = tx
        .insert(comandas)
        .values({ ordenId, estacion, claveIdempotencia: claveIdempotencia ? `${claveIdempotencia}:${estacion}` : null })
        .returning()
        .get();

      tx.update(ordenLineas)
        .set({ estado: 'enviada', comandaId: comanda.id })
        .where(inArray(ordenLineas.id, suyas.map((l) => l.id)))
        .run();

      creadas.push(comanda);
    }
    return { comandas: creadas, repetida: false };
  });
}

/** Lo que ve la pantalla de cocina: comandas sin marcar como listas.
 *  Se excluyen las de mesas ya cobradas o canceladas: nadie marca "listo" un
 *  platillo de una mesa que ya se fue, y sin este filtro el tablero de cocina
 *  se llena de comandas de servicios pasados en cuanto pasan un par de horas. */
export function comandasPendientes(estacion?: 'cocina' | 'barra') {
  const filas = db
    .select({
      comanda: comandas,
      ordenId: ordenes.id,
      folio: ordenes.folio,
      mesa: mesas.nombre,
      mesero: usuarios.nombre,
    })
    .from(comandas)
    .innerJoin(ordenes, eq(ordenes.id, comandas.ordenId))
    .innerJoin(mesas, eq(mesas.id, ordenes.mesaId))
    .innerJoin(usuarios, eq(usuarios.id, ordenes.meseroId))
    .where(
      estacion
        ? and(isNull(comandas.listaEn), eq(comandas.estacion, estacion), eq(ordenes.estado, 'abierta'))
        : and(isNull(comandas.listaEn), eq(ordenes.estado, 'abierta')),
    )
    .orderBy(asc(comandas.enviadaEn))
    .all();

  if (!filas.length) return [];

  const lineas = db
    .select()
    .from(ordenLineas)
    .where(inArray(ordenLineas.comandaId, filas.map((f) => f.comanda.id)))
    .all();

  const mods = lineas.length
    ? db.select().from(lineaModificadores).where(inArray(lineaModificadores.lineaId, lineas.map((l) => l.id))).all()
    : [];

  return filas.map((f) => ({
    ...f.comanda,
    ordenId: f.ordenId,
    folio: f.folio,
    mesa: f.mesa,
    mesero: f.mesero,
    lineas: lineas
      .filter((l) => l.comandaId === f.comanda.id && l.estado !== 'cancelada')
      .map((l) => ({ ...l, modificadores: mods.filter((m) => m.lineaId === l.id) })),
  }));
}

export function marcarComandaLista(comandaId: number) {
  return db.transaction((tx) => {
    const comanda = tx.select().from(comandas).where(eq(comandas.id, comandaId)).get();
    if (!comanda) throw noEncontrado('Comanda');
    if (comanda.listaEn) return comanda;

    tx.update(ordenLineas)
      .set({ estado: 'lista' })
      .where(and(eq(ordenLineas.comandaId, comandaId), eq(ordenLineas.estado, 'enviada')))
      .run();

    return tx
      .update(comandas)
      .set({ listaEn: sql`(datetime('now'))` })
      .where(eq(comandas.id, comandaId))
      .returning()
      .get();
  });
}

/* ── Cancelación con autorización ────────────────────────────────────── */

/** Cancelar algo ya enviado mueve dinero: exige PIN de cajero o administrador
 *  y queda en la bitácora. Nunca se borra la línea. */
export function cancelarLinea(lineaId: number, datos: Cancelacion, solicitanteId: number) {
  const autorizador = autorizar(datos.pinAutorizacion, ['admin', 'cajero']);

  const linea = db.select().from(ordenLineas).where(eq(ordenLineas.id, lineaId)).get();
  if (!linea) throw noEncontrado('Línea');
  if (linea.estado === 'cancelada') throw conflicto('Esa línea ya estaba cancelada');

  const actualizada = db
    .update(ordenLineas)
    .set(
      datos.esCortesia
        ? { esCortesia: true, motivoCancelacion: datos.motivo, canceladaPorId: autorizador.id }
        : { estado: 'cancelada', motivoCancelacion: datos.motivo, canceladaPorId: autorizador.id },
    )
    .where(eq(ordenLineas.id, lineaId))
    .returning()
    .get();

  registrar(
    solicitanteId,
    datos.esCortesia ? 'linea_cortesia' : 'linea_cancelada',
    'orden_linea',
    lineaId,
    `${linea.productoNombre} · ${datos.motivo} · autorizó ${autorizador.nombre}`,
  );
  return actualizada;
}

/* ── Movimientos de mesa ─────────────────────────────────────────────── */

export function transferirOrden(ordenId: number, mesaDestinoId: number, usuarioId: number) {
  return db.transaction((tx) => {
    const orden = tx.select().from(ordenes).where(eq(ordenes.id, ordenId)).get();
    if (!orden) throw noEncontrado('Orden');
    if (orden.estado !== 'abierta') throw conflicto('La orden ya está cerrada');
    if (ordenAbiertaDeMesa(mesaDestinoId)) throw conflicto('La mesa destino ya tiene una orden abierta');

    const destino = tx.select().from(mesas).where(eq(mesas.id, mesaDestinoId)).get();
    if (!destino) throw noEncontrado('Mesa destino');

    tx.update(mesas).set({ estado: 'por_limpiar' }).where(eq(mesas.id, orden.mesaId)).run();
    tx.update(mesas).set({ estado: 'ocupada' }).where(eq(mesas.id, mesaDestinoId)).run();
    const actualizada = tx.update(ordenes).set({ mesaId: mesaDestinoId }).where(eq(ordenes.id, ordenId)).returning().get();

    registrar(usuarioId, 'orden_transferida', 'orden', ordenId, `a mesa ${destino.nombre}`);
    return actualizada;
  });
}

/** Marca la orden como cobrada cuando ya no queda ninguna cuenta abierta. */
export function cerrarOrdenSiProcede(tx: Tx, ordenId: number) {
  // Una cuenta abierta sin consumo asignado no es una cuenta pendiente: es basura
  // que quedó de dividir y volver a juntar. Si la dejáramos viva, la mesa se
  // quedaría ocupada para siempre sin que nadie pueda cobrar nada.
  const abiertasSinCobrar = tx
    .select({ id: cuentas.id })
    .from(cuentas)
    .where(and(eq(cuentas.ordenId, ordenId), eq(cuentas.estado, 'abierta')))
    .all();

  const vacias: number[] = [];
  let conConsumo = 0;
  for (const cuenta of abiertasSinCobrar) {
    const n = tx
      .select({ n: sql<number>`count(*)` })
      .from(cuentaLineas)
      .where(eq(cuentaLineas.cuentaId, cuenta.id))
      .get()?.n ?? 0;
    if (n === 0) vacias.push(cuenta.id);
    else conConsumo++;
  }
  if (conConsumo > 0) return false;
  if (vacias.length) tx.delete(cuentas).where(inArray(cuentas.id, vacias)).run();

  const orden = tx.select().from(ordenes).where(eq(ordenes.id, ordenId)).get();
  if (!orden) return false;

  tx.update(ordenes).set({ estado: 'cobrada', cerradaEn: sql`(datetime('now'))` }).where(eq(ordenes.id, ordenId)).run();
  tx.update(mesas).set({ estado: 'por_limpiar' }).where(eq(mesas.id, orden.mesaId)).run();
  return true;
}


/* ── Tablero del mesero ──────────────────────────────────────────────── */

/** Lo que el mesero necesita ver al entrar: sus mesas y qué reclama atención.
 *  Reemplaza al plano como punto de entrada — el mesero se sabe el salón de
 *  memoria; lo que no puede saber es qué mesa lleva 40 minutos esperando. */
export function tablero() {
  const filasMesas = db
    .select({
      id: mesas.id,
      nombre: mesas.nombre,
      capacidad: mesas.capacidad,
      estado: mesas.estado,
      zonaId: mesas.zonaId,
      zona: zonas.nombre,
      zonaOrden: zonas.orden,
    })
    .from(mesas)
    .innerJoin(zonas, eq(zonas.id, mesas.zonaId))
    .where(eq(mesas.activa, true))
    // Los lugares de una barra (B-1-1, B-1-2…, B-1-10) no se pueden ordenar por
    // nombre: "10" queda antes que "2" alfabéticamente. Se agrupan por barra y
    // se ordenan por su número de lugar; el resto de las mesas, por nombre.
    .orderBy(
      asc(zonas.orden),
      sql`case when ${mesas.barraId} is null then 0 else 1 end`,
      asc(mesas.barraId),
      asc(mesas.numeroLugar),
      asc(mesas.nombre),
    )
    .all();

  const abiertas = db
    .select({
      id: ordenes.id,
      folio: ordenes.folio,
      mesaId: ordenes.mesaId,
      comensales: ordenes.comensales,
      abiertaEn: ordenes.abiertaEn,
      meseroId: ordenes.meseroId,
      mesero: usuarios.nombre,
    })
    .from(ordenes)
    .innerJoin(usuarios, eq(usuarios.id, ordenes.meseroId))
    .where(eq(ordenes.estado, 'abierta'))
    .all();

  const lineas = abiertas.length
    ? db.select().from(ordenLineas).where(inArray(ordenLineas.ordenId, abiertas.map((o) => o.id))).all()
    : [];

  const cuentasAbiertas = abiertas.length
    ? db.select().from(cuentas).where(inArray(cuentas.ordenId, abiertas.map((o) => o.id))).all()
    : [];

  return filasMesas.map((mesa) => {
    const orden = abiertas.find((o) => o.mesaId === mesa.id);
    if (!orden) return { ...mesa, orden: null };

    const suyas = lineas.filter((l) => l.ordenId === orden.id && l.estado !== 'cancelada');
    const totalCentavos = suyas.reduce(
      (a, l) => a + (l.esCortesia ? 0 : Math.round((l.precioUnitarioCentavos * l.cantidadMilesimas) / 1000)),
      0,
    );

    return {
      ...mesa,
      orden: {
        id: orden.id,
        folio: orden.folio,
        comensales: orden.comensales,
        abiertaEn: orden.abiertaEn,
        meseroId: orden.meseroId,
        mesero: orden.mesero,
        totalCentavos,
        sinEnviar: suyas.filter((l) => l.estado === 'pendiente').length,
        listas: suyas.filter((l) => l.estado === 'lista').length,
        cuentasAbiertas: cuentasAbiertas.filter((c) => c.ordenId === orden.id && c.estado === 'abierta').length,
        // Una orden sin consumo se puede cancelar sin autorización: no hay dinero
        // de por medio, es una mesa abierta por error.
        vacia: suyas.length === 0,
      },
    };
  });
}

/** El mesero avisa que la mesa pidió la cuenta. No cobra: eso es de caja. */
export function pedirCuenta(ordenId: number, usuarioId: number) {
  const orden = db.select().from(ordenes).where(eq(ordenes.id, ordenId)).get();
  if (!orden) throw noEncontrado('Orden');
  if (orden.estado !== 'abierta') throw conflicto('La orden ya está cerrada');

  db.update(mesas).set({ estado: 'cuenta_pedida' }).where(eq(mesas.id, orden.mesaId)).run();
  registrar(usuarioId, 'cuenta_pedida', 'orden', ordenId);
  return obtenerOrden(ordenId);
}

/** El mesero confirma que ya llevó a la mesa lo que cocina tenía listo. No es
 *  por platillo: un solo tap limpia toda la señal de "listo" de la mesa. */
export function marcarEntregado(ordenId: number) {
  const orden = db.select().from(ordenes).where(eq(ordenes.id, ordenId)).get();
  if (!orden) throw noEncontrado('Orden');
  if (orden.estado !== 'abierta') throw conflicto('La orden ya está cerrada');

  db.update(ordenLineas)
    .set({ estado: 'servida' })
    .where(and(eq(ordenLineas.ordenId, ordenId), eq(ordenLineas.estado, 'lista')))
    .run();

  return obtenerOrden(ordenId);
}

/** Cancela una mesa abierta por error. Solo si no se capturó nada: en cuanto hay
 *  consumo, lo que corresponde es cancelar línea por línea con autorización. */
export function cancelarOrdenVacia(ordenId: number, usuarioId: number) {
  return db.transaction((tx) => {
    const orden = tx.select().from(ordenes).where(eq(ordenes.id, ordenId)).get();
    if (!orden) throw noEncontrado('Orden');
    if (orden.estado !== 'abierta') throw conflicto('La orden ya está cerrada');

    const conConsumo = tx
      .select({ n: sql<number>`count(*)` })
      .from(ordenLineas)
      .where(and(eq(ordenLineas.ordenId, ordenId), sql`${ordenLineas.estado} <> 'cancelada'`))
      .get()?.n ?? 0;
    if (conConsumo > 0) {
      throw conflicto('Esta mesa ya tiene consumo. Cancela los platillos con autorización antes de cerrarla.');
    }

    tx.update(ordenes).set({ estado: 'cancelada', cerradaEn: sql`(datetime('now'))` }).where(eq(ordenes.id, ordenId)).run();
    tx.update(mesas).set({ estado: 'libre' }).where(eq(mesas.id, orden.mesaId)).run();

    // Toda orden nace con una cuenta (ver abrirOrden). Si no se elimina aquí,
    // queda "abierta" y con $0.00 para siempre, atada a una orden cancelada que
    // nadie va a volver a tocar — y bloquea el cierre de caja sin que exista
    // ninguna pantalla desde la que un admin pueda encontrarla o repararla.
    tx.delete(cuentas).where(eq(cuentas.ordenId, ordenId)).run();

    registrar(usuarioId, 'orden_vacia_cancelada', 'orden', ordenId, `mesa ${orden.mesaId}`);
    return { ok: true };
  });
}
