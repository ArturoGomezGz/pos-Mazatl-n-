import { and, asc, eq, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '../../db/cliente.js';
import { cuentaLineas, cuentas, ordenes, pagos } from '../../db/esquema.js';
import { conflicto, invalido, noEncontrado } from '../../http/errores.js';
import { autorizar, registrar } from '../auth/auth.servicio.js';
import { exigirTurnoAbierto } from '../caja/caja.servicio.js';
import { datosImpuesto } from '../config/config.servicio.js';
import { calcularImpuesto, repartir } from '../dinero.js';
import { cerrarOrdenSiProcede, lineasDeOrden, obtenerOrden } from '../ordenes/ordenes.servicio.js';
import type * as E from './cuentas.esquemas.js';

type Asignacion = z.infer<typeof E.asignacion>;
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

  return filas.map((c) => {
    const actualizada = c.estado === 'abierta' ? calcularCuenta(c.id) : c;
    const asignadas = db.select().from(cuentaLineas).where(eq(cuentaLineas.cuentaId, c.id)).all();
    return {
      ...actualizada,
      lineas: asignadas
        .map((a) => {
          const linea = lineas.find((l) => l.id === a.lineaId);
          return linea ? { ...linea, proporcionMilesimas: a.proporcionMilesimas } : null;
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
        tx.insert(cuentaLineas)
          .values({ cuentaId: cuenta.id, lineaId: linea.id, proporcionMilesimas: Math.round(1000 / partes) })
          .run();
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

  return db.transaction((tx) => {
    tx.delete(pagos).where(eq(pagos.cuentaId, cuentaId)).run();
    const reabierta = tx
      .update(cuentas)
      .set({ estado: 'abierta', cerradaEn: null, turnoId: null })
      .where(eq(cuentas.id, cuentaId))
      .returning()
      .get();
    tx.update(ordenes).set({ estado: 'abierta', cerradaEn: null }).where(eq(ordenes.id, cuenta.ordenId)).run();

    registrar(solicitanteId, 'cuenta_reabierta', 'cuenta', cuentaId, `${datos.motivo} · autorizó ${autorizador.nombre}`);
    return reabierta;
  });
}
