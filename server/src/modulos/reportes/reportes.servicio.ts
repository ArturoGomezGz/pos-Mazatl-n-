import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../../db/cliente.js';
import { cuentas, ordenLineas, ordenes, pagos, usuarios } from '../../db/esquema.js';

/** Rango de un día en hora local del restaurante (America/Mazatlan, sin horario
 *  de verano), expresado como texto para comparar con las fechas guardadas. */
function rango(desde: string, hasta: string) {
  return { desde: `${desde} 00:00:00`, hasta: `${hasta} 23:59:59` };
}

export function ventasDelPeriodo(desde: string, hasta: string) {
  const r = rango(desde, hasta);
  const enRango = and(eq(cuentas.estado, 'cobrada'), gte(cuentas.cerradaEn, r.desde), lte(cuentas.cerradaEn, r.hasta));

  const totales = db
    .select({
      cuentas: sql<number>`count(*)`,
      ventasCentavos: sql<number>`coalesce(sum(${cuentas.totalCentavos}), 0)`,
      propinasCentavos: sql<number>`coalesce(sum(${cuentas.propinaCentavos}), 0)`,
      descuentosCentavos: sql<number>`coalesce(sum(${cuentas.descuentoCentavos}), 0)`,
      impuestosCentavos: sql<number>`coalesce(sum(${cuentas.impuestoCentavos}), 0)`,
    })
    .from(cuentas)
    .where(enRango)
    .get();

  const porMetodo = db
    .select({
      metodo: pagos.metodo,
      total: sql<number>`coalesce(sum(${pagos.montoCentavos}), 0)`,
      operaciones: sql<number>`count(*)`,
    })
    .from(pagos)
    .innerJoin(cuentas, eq(cuentas.id, pagos.cuentaId))
    .where(enRango)
    .groupBy(pagos.metodo)
    .all();

  const cuentasCobradas = totales?.cuentas ?? 0;
  return {
    desde,
    hasta,
    ...totales,
    ticketPromedioCentavos: cuentasCobradas ? Math.round((totales?.ventasCentavos ?? 0) / cuentasCobradas) : 0,
    porMetodo,
  };
}

export function productosMasVendidos(desde: string, hasta: string, limite = 20) {
  const r = rango(desde, hasta);
  return db
    .select({
      producto: ordenLineas.productoNombre,
      variante: ordenLineas.varianteNombre,
      cantidad: sql<number>`sum(${ordenLineas.cantidadMilesimas}) / 1000.0`,
      importeCentavos: sql<number>`coalesce(sum(${ordenLineas.precioUnitarioCentavos} * ${ordenLineas.cantidadMilesimas} / 1000), 0)`,
    })
    .from(ordenLineas)
    .innerJoin(ordenes, eq(ordenes.id, ordenLineas.ordenId))
    .where(
      and(
        sql`${ordenLineas.estado} <> 'cancelada'`,
        gte(ordenes.abiertaEn, r.desde),
        lte(ordenes.abiertaEn, r.hasta),
      ),
    )
    .groupBy(ordenLineas.productoNombre, ordenLineas.varianteNombre)
    .orderBy(sql`sum(${ordenLineas.cantidadMilesimas}) desc`)
    .limit(limite)
    .all();
}

export function ventasPorMesero(desde: string, hasta: string) {
  const r = rango(desde, hasta);
  return db
    .select({
      mesero: usuarios.nombre,
      cuentas: sql<number>`count(distinct ${cuentas.id})`,
      ventasCentavos: sql<number>`coalesce(sum(${cuentas.totalCentavos}), 0)`,
      propinasCentavos: sql<number>`coalesce(sum(${cuentas.propinaCentavos}), 0)`,
    })
    .from(cuentas)
    .innerJoin(ordenes, eq(ordenes.id, cuentas.ordenId))
    .innerJoin(usuarios, eq(usuarios.id, ordenes.meseroId))
    .where(and(eq(cuentas.estado, 'cobrada'), gte(cuentas.cerradaEn, r.desde), lte(cuentas.cerradaEn, r.hasta)))
    .groupBy(usuarios.nombre)
    .orderBy(sql`sum(${cuentas.totalCentavos}) desc`)
    .all();
}

/** Cancelaciones y cortesías: el reporte que un dueño revisa cuando algo no cuadra. */
export function cancelaciones(desde: string, hasta: string) {
  const r = rango(desde, hasta);
  return db
    .select({
      id: ordenLineas.id,
      producto: ordenLineas.productoNombre,
      importeCentavos: sql<number>`${ordenLineas.precioUnitarioCentavos} * ${ordenLineas.cantidadMilesimas} / 1000`,
      motivo: ordenLineas.motivoCancelacion,
      esCortesia: ordenLineas.esCortesia,
      autorizo: usuarios.nombre,
      fecha: ordenLineas.creadoEn,
      folio: ordenes.folio,
    })
    .from(ordenLineas)
    .innerJoin(ordenes, eq(ordenes.id, ordenLineas.ordenId))
    .leftJoin(usuarios, eq(usuarios.id, ordenLineas.canceladaPorId))
    .where(
      and(
        sql`(${ordenLineas.estado} = 'cancelada' or ${ordenLineas.esCortesia} = 1)`,
        gte(ordenLineas.creadoEn, r.desde),
        lte(ordenLineas.creadoEn, r.hasta),
      ),
    )
    .orderBy(sql`${ordenLineas.id} desc`)
    .all();
}
