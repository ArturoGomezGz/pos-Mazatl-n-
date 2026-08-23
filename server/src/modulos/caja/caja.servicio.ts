import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/cliente.js';
import { cuentas, movimientosCaja, pagos, turnosCaja, usuarios } from '../../db/esquema.js';
import { conflicto, noEncontrado } from '../../http/errores.js';
import { registrar } from '../auth/auth.servicio.js';

export type TipoMovimiento = (typeof movimientosCaja.$inferSelect)['tipo'];

/** Sin turno abierto no se cobra. Es la regla que hace que el corte cuadre. */
export function turnoAbierto() {
  return db.select().from(turnosCaja).where(eq(turnosCaja.estado, 'abierto')).orderBy(asc(turnosCaja.id)).get();
}

export function exigirTurnoAbierto() {
  const turno = turnoAbierto();
  if (!turno) throw conflicto('No hay un turno de caja abierto. Ábrelo antes de cobrar.');
  return turno;
}

export function abrirTurno(usuarioId: number, fondoInicialCentavos: number) {
  if (turnoAbierto()) throw conflicto('Ya hay un turno de caja abierto');
  const turno = db.insert(turnosCaja).values({ usuarioId, fondoInicialCentavos }).returning().get();
  registrar(usuarioId, 'turno_abierto', 'turno_caja', turno.id, `fondo ${fondoInicialCentavos}`);
  return turno;
}

export function registrarMovimiento(datos: {
  tipo: TipoMovimiento;
  montoCentavos: number;
  concepto: string;
  usuarioId: number;
}) {
  const turno = exigirTurnoAbierto();
  const movimiento = db
    .insert(movimientosCaja)
    .values({ turnoId: turno.id, tipo: datos.tipo, montoCentavos: datos.montoCentavos, concepto: datos.concepto, usuarioId: datos.usuarioId })
    .returning()
    .get();
  registrar(datos.usuarioId, `caja_${datos.tipo}`, 'movimiento_caja', movimiento.id, datos.concepto);
  return movimiento;
}

/** Corte X (parcial) y base del corte Z: qué debería haber en la caja y por qué. */
export function resumenTurno(turnoId: number) {
  const turno = db.select().from(turnosCaja).where(eq(turnosCaja.id, turnoId)).get();
  if (!turno) throw noEncontrado('Turno');

  const porMetodo = db
    .select({
      metodo: pagos.metodo,
      total: sql<number>`coalesce(sum(${pagos.montoCentavos}), 0)`,
      operaciones: sql<number>`count(*)`,
    })
    .from(pagos)
    .where(eq(pagos.turnoId, turnoId))
    .groupBy(pagos.metodo)
    .all();

  const cerradas = db
    .select({
      cuentas: sql<number>`count(*)`,
      propinas: sql<number>`coalesce(sum(${cuentas.propinaCentavos}), 0)`,
      descuentos: sql<number>`coalesce(sum(${cuentas.descuentoCentavos}), 0)`,
      impuestos: sql<number>`coalesce(sum(${cuentas.impuestoCentavos}), 0)`,
      ventas: sql<number>`coalesce(sum(${cuentas.totalCentavos}), 0)`,
    })
    .from(cuentas)
    .where(and(eq(cuentas.turnoId, turnoId), eq(cuentas.estado, 'cobrada')))
    .get();

  const movimientos = db
    .select({
      id: movimientosCaja.id,
      tipo: movimientosCaja.tipo,
      montoCentavos: movimientosCaja.montoCentavos,
      concepto: movimientosCaja.concepto,
      creadoEn: movimientosCaja.creadoEn,
      usuario: usuarios.nombre,
    })
    .from(movimientosCaja)
    .innerJoin(usuarios, eq(usuarios.id, movimientosCaja.usuarioId))
    .where(eq(movimientosCaja.turnoId, turnoId))
    .orderBy(asc(movimientosCaja.id))
    .all();

  const suma = (tipo: TipoMovimiento) =>
    movimientos.filter((m) => m.tipo === tipo).reduce((a, m) => a + m.montoCentavos, 0);

  const efectivoCobrado = porMetodo.find((m) => m.metodo === 'efectivo')?.total ?? 0;
  const entradas = suma('entrada');
  const salidas = suma('retiro') + suma('gasto') + suma('propina_pagada');

  return {
    turno,
    porMetodo,
    cuentasCobradas: cerradas?.cuentas ?? 0,
    ventasCentavos: cerradas?.ventas ?? 0,
    propinasCentavos: cerradas?.propinas ?? 0,
    descuentosCentavos: cerradas?.descuentos ?? 0,
    impuestosCentavos: cerradas?.impuestos ?? 0,
    movimientos,
    entradasCentavos: entradas,
    salidasCentavos: salidas,
    // Lo que debería haber físicamente en el cajón.
    esperadoEfectivoCentavos: turno.fondoInicialCentavos + efectivoCobrado + entradas - salidas,
  };
}

/** Corte Z: cierra el turno y deja la diferencia registrada, sea cual sea. */
export function cerrarTurno(turnoId: number, declaradoCentavos: number, usuarioId: number) {
  const resumen = resumenTurno(turnoId);
  if (resumen.turno.estado === 'cerrado') throw conflicto('Ese turno ya está cerrado');

  const abiertas = db
    .select({ n: sql<number>`count(*)` })
    .from(cuentas)
    .where(eq(cuentas.estado, 'abierta'))
    .get()?.n ?? 0;
  if (abiertas > 0) throw conflicto(`Todavía hay ${abiertas} cuenta(s) sin cobrar. Ciérralas antes del corte.`);

  const esperado = resumen.esperadoEfectivoCentavos;
  const cerrado = db
    .update(turnosCaja)
    .set({
      estado: 'cerrado',
      cerradoEn: sql`(datetime('now'))`,
      declaradoCentavos,
      esperadoCentavos: esperado,
      diferenciaCentavos: declaradoCentavos - esperado,
    })
    .where(eq(turnosCaja.id, turnoId))
    .returning()
    .get();

  registrar(usuarioId, 'turno_cerrado', 'turno_caja', turnoId, `diferencia ${declaradoCentavos - esperado}`);
  return { ...resumen, turno: cerrado, diferenciaCentavos: declaradoCentavos - esperado };
}

export function listarTurnos(limite = 30) {
  return db
    .select({
      id: turnosCaja.id,
      abiertoEn: turnosCaja.abiertoEn,
      cerradoEn: turnosCaja.cerradoEn,
      estado: turnosCaja.estado,
      fondoInicialCentavos: turnosCaja.fondoInicialCentavos,
      declaradoCentavos: turnosCaja.declaradoCentavos,
      esperadoCentavos: turnosCaja.esperadoCentavos,
      diferenciaCentavos: turnosCaja.diferenciaCentavos,
      usuario: usuarios.nombre,
    })
    .from(turnosCaja)
    .innerJoin(usuarios, eq(usuarios.id, turnosCaja.usuarioId))
    .orderBy(sql`${turnosCaja.id} desc`)
    .limit(limite)
    .all();
}
