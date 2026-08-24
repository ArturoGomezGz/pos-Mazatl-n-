import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '../../db/cliente.js';
import { cuentaLineas, cuentas, lineaModificadores, mesas, ordenLineas, ordenes, pagos } from '../../db/esquema.js';
import { conflicto, invalido, noEncontrado } from '../../http/errores.js';
import { autorizar, registrar } from '../auth/auth.servicio.js';
import { exigirTurnoAbierto } from '../caja/caja.servicio.js';
import { datosImpuesto } from '../config/config.servicio.js';
import { calcularImpuesto, repartir } from '../dinero.js';
import { cerrarOrdenSiProcede, lineasDeOrden, obtenerOrden, ordenAbiertaDeMesa } from '../ordenes/ordenes.servicio.js';
import type * as E from './cuentas.esquemas.js';

type Asignacion = z.infer<typeof E.asignacion>;
type Reparto = z.infer<typeof E.reparto>;
type Movimiento = z.infer<typeof E.movimiento>;
type Descuento = z.infer<typeof E.descuento>;
type Cobro = z.infer<typeof E.cobro>;
type Reapertura = z.infer<typeof E.reapertura>;

/* ── Reparto del consumo entre cuentas ───────────────────────────────── */

/** Subtotal de cada cuenta de la orden. Cuando una línea está partida entre
 *  varias cuentas, el importe se reparte **sin perder ni un centavo**. */
export function subtotalesPorCuenta(ordenId: number): Map<number, number> {
  const lineas = lineasDeOrden(ordenId);
  const asignaciones = db
    .select({ cuentaId: cuentaLineas.cuentaId, lineaId: cuentaLineas.lineaId, proporcion: cuentaLineas.proporcionMilesimas })
    .from(cuentaLineas)
    .innerJoin(cuentas, eq(cuentas.id, cuentaLineas.cuentaId))
    .where(eq(cuentas.ordenId, ordenId))
    .orderBy(asc(cuentaLineas.cuentaId))
    .all();

  const totales = new Map<number, number>();
  for (const cuenta of db.select({ id: cuentas.id }).from(cuentas).where(eq(cuentas.ordenId, ordenId)).all()) {
    totales.set(cuenta.id, 0);
  }

  for (const linea of lineas) {
    const suyas = asignaciones.filter((a) => a.lineaId === linea.id);
    if (!suyas.length) continue;
    const partes = repartir(linea.totalCentavos, suyas.map((a) => a.proporcion));
    suyas.forEach((a, i) => totales.set(a.cuentaId, (totales.get(a.cuentaId) ?? 0) + (partes[i] ?? 0)));
  }
  return totales;
}

/** Recalcula y persiste los importes de una cuenta. El servidor es la autoridad:
 *  lo que manda el navegador nunca decide un total. */
export function calcularCuenta(cuentaId: number) {
  const cuenta = db.select().from(cuentas).where(eq(cuentas.id, cuentaId)).get();
  if (!cuenta) throw noEncontrado('Cuenta');
  if (cuenta.estado === 'cobrada') return cuenta;

  const subtotal = subtotalesPorCuenta(cuenta.ordenId).get(cuentaId) ?? 0;
  const descuento = Math.min(cuenta.descuentoCentavos, subtotal);
  const base = subtotal - descuento;
  const { tasaPorMil, incluido } = datosImpuesto();
  const { impuesto, sumaAlTotal } = calcularImpuesto(base, tasaPorMil, incluido);
  const total = base + sumaAlTotal + cuenta.propinaCentavos;

  return db
    .update(cuentas)
    .set({ subtotalCentavos: subtotal, descuentoCentavos: descuento, impuestoCentavos: impuesto, totalCentavos: total })
    .where(eq(cuentas.id, cuentaId))
    .returning()
    .get();
}

/** Las cuentas de una orden, ya recalculadas y con sus líneas y pagos. */
export function cuentasDeOrden(ordenId: number) {
  const lineas = lineasDeOrden(ordenId);
  const filas = db.select().from(cuentas).where(eq(cuentas.ordenId, ordenId)).orderBy(asc(cuentas.id)).all();
  const todasLasAsignaciones = db
    .select({ cuentaId: cuentaLineas.cuentaId, lineaId: cuentaLineas.lineaId })
    .from(cuentaLineas)
    .innerJoin(cuentas, eq(cuentas.id, cuentaLineas.cuentaId))
    .where(eq(cuentas.ordenId, ordenId))
    .all();

  return filas.map((c) => {
    const actualizada = c.estado === 'abierta' ? calcularCuenta(c.id) : c;
    const asignadas = db.select().from(cuentaLineas).where(eq(cuentaLineas.cuentaId, c.id)).all();
    return {
      ...actualizada,
      lineas: asignadas
        .map((a) => {
          const linea = lineas.find((l) => l.id === a.lineaId);
          if (!linea) return null;
          const cuentaIds = todasLasAsignaciones.filter((x) => x.lineaId === a.lineaId).map((x) => x.cuentaId);
          return { ...linea, proporcionMilesimas: a.proporcionMilesimas, cuentaIds };
        })
        .filter((l): l is NonNullable<typeof l> => Boolean(l)),
      pagos: db.select().from(pagos).where(eq(pagos.cuentaId, c.id)).orderBy(asc(pagos.id)).all(),
    };
  });
}

/* ── Alta y división ─────────────────────────────────────────────────── */

export function crearCuenta(ordenId: number, nombre?: string) {
  const orden = db.select().from(ordenes).where(eq(ordenes.id, ordenId)).get();
  if (!orden) throw noEncontrado('Orden');
  if (orden.estado !== 'abierta') throw conflicto('La orden ya está cerrada');

  const n = db.select({ n: sql<number>`count(*)` }).from(cuentas).where(eq(cuentas.ordenId, ordenId)).get()?.n ?? 0;
  return db.insert(cuentas).values({ ordenId, nombre: nombre ?? `Cuenta ${n + 1}` }).returning().get();
}

export function eliminarCuenta(cuentaId: number) {
  const cuenta = db.select().from(cuentas).where(eq(cuentas.id, cuentaId)).get();
  if (!cuenta) throw noEncontrado('Cuenta');
  if (cuenta.estado === 'cobrada') throw conflicto('Una cuenta cobrada no se elimina');

  const hermanas = db.select().from(cuentas).where(eq(cuentas.ordenId, cuenta.ordenId)).all();
  if (hermanas.length <= 1) throw conflicto('La orden debe conservar al menos una cuenta');

  return db.transaction((tx) => {
    // Lo que tuviera asignado regresa a la primera cuenta abierta: nada se pierde.
    const destino = hermanas.find((c) => c.id !== cuentaId && c.estado === 'abierta');
    if (!destino) throw conflicto('No hay otra cuenta abierta a la cual mover el consumo');

    for (const a of tx.select().from(cuentaLineas).where(eq(cuentaLineas.cuentaId, cuentaId)).all()) {
      const yaEsta = tx
        .select()
        .from(cuentaLineas)
        .where(and(eq(cuentaLineas.cuentaId, destino.id), eq(cuentaLineas.lineaId, a.lineaId)))
        .get();
      if (!yaEsta) {
        tx.insert(cuentaLineas).values({ cuentaId: destino.id, lineaId: a.lineaId, proporcionMilesimas: a.proporcionMilesimas }).run();
      }
    }
    return tx.delete(cuentas).where(eq(cuentas.id, cuentaId)).returning().get();
  });
}

/** Mueve una línea (o una fracción) a una cuenta: dividir por platillo. */
export function asignarLinea(datos: Asignacion) {
  return db.transaction((tx) => {
    const cuenta = tx.select().from(cuentas).where(eq(cuentas.id, datos.cuentaId)).get();
    if (!cuenta) throw noEncontrado('Cuenta');
    if (cuenta.estado !== 'abierta') throw conflicto('Esa cuenta ya fue cobrada');

    // La línea tiene que ser de la misma mesa que la cuenta destino. Sin este
    // control, dos órdenes distintas podían enlazarse por error (o por una
    // llamada directa a la API) y dejar una asociación cruzada que ningún
    // reporte espera encontrar.
    const linea = tx.select({ ordenId: ordenLineas.ordenId }).from(ordenLineas).where(eq(ordenLineas.id, datos.lineaId)).get();
    if (!linea) throw noEncontrado('Línea');
    if (linea.ordenId !== cuenta.ordenId) throw conflicto('Ese platillo no pertenece a esta mesa');

    if (datos.exclusiva) {
      const hermanas = tx.select({ id: cuentas.id }).from(cuentas).where(eq(cuentas.ordenId, cuenta.ordenId)).all();
      for (const h of hermanas) {
        tx.delete(cuentaLineas).where(and(eq(cuentaLineas.cuentaId, h.id), eq(cuentaLineas.lineaId, datos.lineaId))).run();
      }
    } else {
      tx.delete(cuentaLineas)
        .where(and(eq(cuentaLineas.cuentaId, datos.cuentaId), eq(cuentaLineas.lineaId, datos.lineaId)))
        .run();
    }

    tx.insert(cuentaLineas)
      .values({ cuentaId: datos.cuentaId, lineaId: datos.lineaId, proporcionMilesimas: datos.proporcionMilesimas })
      .run();

    return cuentasDeOrden(cuenta.ordenId);
  });
}

/** Reparte UN platillo entre varias cuentas: la botana que compartieron. El
 *  importe se divide en partes exactas entre las cuentas elegidas. */
export function repartirLinea(datos: Reparto) {
  return db.transaction((tx) => {
    const destinos = tx.select().from(cuentas).where(inArray(cuentas.id, datos.cuentaIds)).all();
    if (destinos.length !== datos.cuentaIds.length) throw noEncontrado('Cuenta');
    if (destinos.some((c) => c.estado !== 'abierta')) throw conflicto('Alguna de esas cuentas ya fue cobrada');

    const ordenId = destinos[0]!.ordenId;
    if (destinos.some((c) => c.ordenId !== ordenId)) throw conflicto('Las cuentas deben ser de la misma mesa');

    const linea = tx.select({ ordenId: ordenLineas.ordenId }).from(ordenLineas).where(eq(ordenLineas.id, datos.lineaId)).get();
    if (!linea) throw noEncontrado('Línea');
    if (linea.ordenId !== ordenId) throw conflicto('Ese platillo no pertenece a esta mesa');

    // Se quita de todas las cuentas de la orden y se reparte solo entre las elegidas.
    const hermanas = tx.select({ id: cuentas.id }).from(cuentas).where(eq(cuentas.ordenId, ordenId)).all();
    for (const h of hermanas) {
      tx.delete(cuentaLineas).where(and(eq(cuentaLineas.cuentaId, h.id), eq(cuentaLineas.lineaId, datos.lineaId))).run();
    }
    for (const destino of destinos) {
      tx.insert(cuentaLineas).values({ cuentaId: destino.id, lineaId: datos.lineaId, proporcionMilesimas: 1000 }).run();
    }
    return cuentasDeOrden(ordenId);
  });
}

/** Mueve N unidades (milesimas) de un grupo de líneas a otra cuenta, de a una si
 *  hace falta: si una línea no cabe entera en lo que falta por mover, se parte
 *  en dos (la parte movida se vuelve una línea nueva, exclusiva del destino). */
export function moverUnidades(datos: Movimiento) {
  return db.transaction((tx) => {
    const destino = tx.select().from(cuentas).where(eq(cuentas.id, datos.cuentaDestinoId)).get();
    if (!destino) throw noEncontrado('Cuenta');
    if (destino.estado !== 'abierta') throw conflicto('Esa cuenta ya fue cobrada');

    const lineas = tx.select().from(ordenLineas).where(inArray(ordenLineas.id, datos.lineaIds)).all();
    if (lineas.length !== datos.lineaIds.length) throw noEncontrado('Línea');
    if (lineas.some((l) => l.ordenId !== destino.ordenId)) throw conflicto('Ese platillo no pertenece a esta mesa');

    const disponible = lineas.reduce((a, l) => a + l.cantidadMilesimas, 0);
    if (datos.cantidadMilesimas > disponible) throw invalido('No hay esa cantidad para mover');

    // Se procesan en el orden recibido: primero se agotan las líneas más
    // viejas antes de partir la última que haga falta.
    const ordenadas = [...lineas].sort((a, b) => datos.lineaIds.indexOf(a.id) - datos.lineaIds.indexOf(b.id));

    let restante = datos.cantidadMilesimas;
    for (const linea of ordenadas) {
      if (restante <= 0) break;

      const mover = Math.min(linea.cantidadMilesimas, restante);
      const lineaMovidaId =
        mover === linea.cantidadMilesimas
          ? linea.id
          : tx
              .insert(ordenLineas)
              .values({
                ordenId: linea.ordenId,
                comandaId: linea.comandaId,
                productoId: linea.productoId,
                varianteId: linea.varianteId,
                productoNombre: linea.productoNombre,
                varianteNombre: linea.varianteNombre,
                estacion: linea.estacion,
                unidad: linea.unidad,
                precioUnitarioCentavos: linea.precioUnitarioCentavos,
                cantidadMilesimas: mover,
                nota: linea.nota,
                estado: linea.estado,
                esCortesia: linea.esCortesia,
              })
              .returning({ id: ordenLineas.id })
              .get().id;

      if (mover !== linea.cantidadMilesimas) {
        // La línea original se queda con lo que no se movió.
        tx.update(ordenLineas).set({ cantidadMilesimas: linea.cantidadMilesimas - mover }).where(eq(ordenLineas.id, linea.id)).run();

        const modificadores = tx.select().from(lineaModificadores).where(eq(lineaModificadores.lineaId, linea.id)).all();
        for (const m of modificadores) {
          tx.insert(lineaModificadores)
            .values({ lineaId: lineaMovidaId, modificadorId: m.modificadorId, nombre: m.nombre, precioExtraCentavos: m.precioExtraCentavos })
            .run();
        }
      }

      // La porción movida queda exclusiva del destino.
      tx.delete(cuentaLineas).where(eq(cuentaLineas.lineaId, lineaMovidaId)).run();
      tx.insert(cuentaLineas).values({ cuentaId: destino.id, lineaId: lineaMovidaId, proporcionMilesimas: 1000 }).run();

      restante -= mover;
    }

    return cuentasDeOrden(destino.ordenId);
  });
}

/** División en partes iguales: cada quien paga lo mismo, aunque hayan compartido. */
export function dividirEnPartesIguales(ordenId: number, partes: number) {
  return db.transaction((tx) => {
    const orden = tx.select().from(ordenes).where(eq(ordenes.id, ordenId)).get();
    if (!orden) throw noEncontrado('Orden');
    if (orden.estado !== 'abierta') throw conflicto('La orden ya está cerrada');

    const existentes = tx.select().from(cuentas).where(eq(cuentas.ordenId, ordenId)).all();
    if (existentes.some((c) => c.estado === 'cobrada')) {
      throw conflicto('Ya se cobró una parte de esta orden: no se puede volver a dividir');
    }

    for (const c of existentes.slice(1)) tx.delete(cuentas).where(eq(cuentas.id, c.id)).run();
    const primera = existentes[0] ?? tx.insert(cuentas).values({ ordenId, nombre: 'Cuenta 1' }).returning().get();

    const nuevas = [primera];
    for (let i = existentes.length ? 1 : 1; nuevas.length < partes; i++) {
      nuevas.push(tx.insert(cuentas).values({ ordenId, nombre: `Cuenta ${nuevas.length + 1}` }).returning().get());
    }

    const lineas = lineasDeOrden(ordenId).filter((l) => l.estado !== 'cancelada');
    for (const cuenta of nuevas) {
      tx.delete(cuentaLineas).where(eq(cuentaLineas.cuentaId, cuenta.id)).run();
      for (const linea of lineas) {
        // La proporción es un peso relativo: el mismo peso en todas las cuentas
        // reparte el importe exacto, sin perder centavos por redondeo.
        tx.insert(cuentaLineas).values({ cuentaId: cuenta.id, lineaId: linea.id, proporcionMilesimas: 1000 }).run();
      }
    }
    return cuentasDeOrden(ordenId);
  });
}

/* ── Descuento, propina y cobro ──────────────────────────────────────── */

export function aplicarDescuento(cuentaId: number, datos: Descuento, solicitanteId: number) {
  const autorizador = autorizar(datos.pinAutorizacion, ['admin', 'cajero']);
  const cuenta = calcularCuenta(cuentaId);
  if (cuenta.estado !== 'abierta') throw conflicto('Esa cuenta ya fue cobrada');

  const monto =
    datos.tipo === 'porcentaje'
      ? Math.round((cuenta.subtotalCentavos * Math.min(datos.valor, 100)) / 100)
      : Math.min(datos.valor, cuenta.subtotalCentavos);

  db.update(cuentas)
    .set({ descuentoCentavos: monto, motivoDescuento: datos.motivo, autorizadoPorId: autorizador.id })
    .where(eq(cuentas.id, cuentaId))
    .run();

  registrar(solicitanteId, 'descuento_aplicado', 'cuenta', cuentaId, `${monto} · ${datos.motivo} · autorizó ${autorizador.nombre}`);
  return calcularCuenta(cuentaId);
}

export function establecerPropina(cuentaId: number, propinaCentavos: number) {
  const cuenta = db.select().from(cuentas).where(eq(cuentas.id, cuentaId)).get();
  if (!cuenta) throw noEncontrado('Cuenta');
  if (cuenta.estado !== 'abierta') throw conflicto('Esa cuenta ya fue cobrada');
  db.update(cuentas).set({ propinaCentavos }).where(eq(cuentas.id, cuentaId)).run();
  return calcularCuenta(cuentaId);
}

/** Cobro. Idempotente: si el cobro llega dos veces por un reintento de red,
 *  se registra una sola vez. Es la protección contra el doble cargo. */
export function cobrar(cuentaId: number, datos: Cobro, usuarioId: number) {
  if (datos.claveIdempotencia) {
    // Reintento de la misma operación: se responde el estado actual, no se cobra otra vez.
    const previo = db.select().from(pagos).where(eq(pagos.claveIdempotencia, `${datos.claveIdempotencia}:0`)).get();
    if (previo) {
      const yaCobrada = db.select().from(cuentas).where(eq(cuentas.id, cuentaId)).get();
      if (!yaCobrada) throw noEncontrado('Cuenta');
      const orden = obtenerOrden(yaCobrada.ordenId);
      return { cuenta: yaCobrada, repetido: true, ordenCerrada: orden.estado === 'cobrada', orden };
    }
  }

  const turno = exigirTurnoAbierto();
  const cuenta = calcularCuenta(cuentaId);
  if (cuenta.estado !== 'abierta') throw conflicto('Esa cuenta ya fue cobrada');

  const suma = datos.pagos.reduce((a, p) => a + p.montoCentavos, 0);
  if (suma !== cuenta.totalCentavos) {
    throw invalido(`Los pagos suman ${suma} y la cuenta es de ${cuenta.totalCentavos}`);
  }

  return db.transaction((tx) => {
    datos.pagos.forEach((p, i) => {
      const cambio =
        p.metodo === 'efectivo' && p.recibidoCentavos !== undefined
          ? Math.max(0, p.recibidoCentavos - p.montoCentavos)
          : null;
      tx.insert(pagos)
        .values({
          cuentaId,
          turnoId: turno.id,
          metodo: p.metodo,
          montoCentavos: p.montoCentavos,
          referencia: p.referencia,
          recibidoCentavos: p.recibidoCentavos ?? null,
          cambioCentavos: cambio,
          claveIdempotencia: datos.claveIdempotencia ? `${datos.claveIdempotencia}:${i}` : null,
        })
        .run();
    });

    const cobrada = tx
      .update(cuentas)
      .set({ estado: 'cobrada', turnoId: turno.id, cerradaEn: sql`(datetime('now'))` })
      .where(eq(cuentas.id, cuentaId))
      .returning()
      .get();

    const ordenCerrada = cerrarOrdenSiProcede(tx, cuenta.ordenId);
    registrar(usuarioId, 'cuenta_cobrada', 'cuenta', cuentaId, `${cuenta.totalCentavos} centavos`);
    return { cuenta: cobrada, repetido: false, ordenCerrada, orden: obtenerOrden(cuenta.ordenId) };
  });
}

/** Reabrir una cuenta cobrada: cancela sus pagos y deja rastro. Solo con
 *  autorización, porque es la puerta trasera obvia para robar. */
export function reabrirCuenta(cuentaId: number, datos: Reapertura, solicitanteId: number) {
  const autorizador = autorizar(datos.pinAutorizacion, ['admin']);
  const cuenta = db.select().from(cuentas).where(eq(cuentas.id, cuentaId)).get();
  if (!cuenta) throw noEncontrado('Cuenta');
  if (cuenta.estado !== 'cobrada') throw conflicto('Esa cuenta no está cobrada');

  const orden = db.select().from(ordenes).where(eq(ordenes.id, cuenta.ordenId)).get();
  if (!orden) throw noEncontrado('Orden');

  // La mesa pudo haber servido a otro grupo desde que esta cuenta se cobró
  // (es justo lo que pasa en un festivo con rotación rápida). Reabrir sin este
  // chequeo dejaría dos órdenes "abiertas" en la misma mesa a la vez: el mismo
  // estado imposible que abrirOrden() y transferirOrden() nunca permiten crear.
  const ordenActivaEnMesa = ordenAbiertaDeMesa(orden.mesaId);
  if (ordenActivaEnMesa && ordenActivaEnMesa.id !== orden.id) {
    throw conflicto('Esa mesa ya está sirviendo a otro grupo. No se puede reabrir esta cuenta ahí.');
  }

  return db.transaction((tx) => {
    tx.delete(pagos).where(eq(pagos.cuentaId, cuentaId)).run();
    const reabierta = tx
      .update(cuentas)
      .set({ estado: 'abierta', cerradaEn: null, turnoId: null })
      .where(eq(cuentas.id, cuentaId))
      .returning()
      .get();
    tx.update(ordenes).set({ estado: 'abierta', cerradaEn: null }).where(eq(ordenes.id, cuenta.ordenId)).run();
    tx.update(mesas).set({ estado: 'ocupada' }).where(eq(mesas.id, orden.mesaId)).run();

    registrar(solicitanteId, 'cuenta_reabierta', 'cuenta', cuentaId, `${datos.motivo} · autorizó ${autorizador.nombre}`);
    return reabierta;
  });
}
