import { and, asc, eq, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '../../db/cliente.js';
import { elementosPlano, layouts, mesaPosiciones, mesas, zonas } from '../../db/esquema.js';
import { conflicto, noEncontrado } from '../../http/errores.js';
import type * as E from './salon.esquemas.js';

type ZonaNueva = z.infer<typeof E.zonaNueva>;
type ZonaCambio = z.infer<typeof E.zonaCambio>;
type MesaNueva = z.infer<typeof E.mesaNueva>;
type MesaCambio = z.infer<typeof E.mesaCambio>;
type ElementoNuevo = z.infer<typeof E.elementoNuevo>;
type ElementoCambio = z.infer<typeof E.elementoCambio>;
type LayoutNuevo = z.infer<typeof E.layoutNuevo>;
type LayoutCambio = z.infer<typeof E.layoutCambio>;
type PosicionesLote = z.infer<typeof E.posicionesLote>;

/* ── Distribuciones (layouts) ───────────────────────────────────────────── */

export function listarLayouts() {
  return db.select().from(layouts).orderBy(asc(layouts.id)).all();
}

/** Devuelve la distribución activa, o la primera que exista. */
export function layoutActivo() {
  return (
    db.select().from(layouts).where(eq(layouts.activo, true)).get() ??
    db.select().from(layouts).orderBy(asc(layouts.id)).get()
  );
}

export function crearLayout(datos: LayoutNuevo) {
  return db.transaction((tx) => {
    const nuevo = tx.insert(layouts).values({ nombre: datos.nombre, activo: false }).returning().get();

    // Copiar una distribución existente es la forma real de crear otra: el dueño
    // parte de su comedor normal y solo mueve lo que cambia en temporada alta.
    const origenId = datos.copiarDeId ?? layoutActivo()?.id;
    if (origenId && origenId !== nuevo.id) {
      const posiciones = tx.select().from(mesaPosiciones).where(eq(mesaPosiciones.layoutId, origenId)).all();
      if (posiciones.length) {
        tx.insert(mesaPosiciones)
          .values(posiciones.map((p) => ({ ...p, layoutId: nuevo.id })))
          .run();
      }
      const elementos = tx.select().from(elementosPlano).where(eq(elementosPlano.layoutId, origenId)).all();
      for (const el of elementos) {
        const { id: _omitido, ...resto } = el;
        tx.insert(elementosPlano).values({ ...resto, layoutId: nuevo.id }).run();
      }
    }
    return nuevo;
  });
}

export function actualizarLayout(id: number, cambios: LayoutCambio) {
  return db.transaction((tx) => {
    const existente = tx.select().from(layouts).where(eq(layouts.id, id)).get();
    if (!existente) throw noEncontrado('Layout');

    if (cambios.activo) {
      // Solo una distribución activa a la vez.
      tx.update(layouts).set({ activo: false }).run();
    }
    const set: Partial<typeof layouts.$inferInsert> = {};
    if (cambios.nombre !== undefined) set.nombre = cambios.nombre;
    if (cambios.activo !== undefined) set.activo = cambios.activo;
    if (Object.keys(set).length === 0) return existente;

    return tx.update(layouts).set(set).where(eq(layouts.id, id)).returning().get();
  });
}

export function eliminarLayout(id: number) {
  const total = db.select({ n: sql<number>`count(*)` }).from(layouts).get()?.n ?? 0;
  if (total <= 1) throw conflicto('Debe existir al menos una distribución del comedor');

  const borrado = db.delete(layouts).where(eq(layouts.id, id)).returning().get();
  if (!borrado) throw noEncontrado('Layout');

  // Si se borró la activa, activamos la primera que quede: nunca sin distribución.
  if (borrado.activo) {
    const siguiente = db.select().from(layouts).orderBy(asc(layouts.id)).get();
    if (siguiente) db.update(layouts).set({ activo: true }).where(eq(layouts.id, siguiente.id)).run();
  }
  return borrado;
}

/* ── Plano completo ─────────────────────────────────────────────────────── */

/** Todo lo que el editor y la vista de salón necesitan, en una sola petición.
 *  El plano completo de un restaurante pequeño son unos pocos KB: paginarlo
 *  sería complejidad sin beneficio. */
export function obtenerPlano(layoutIdSolicitado?: number) {
  const layout = layoutIdSolicitado
    ? db.select().from(layouts).where(eq(layouts.id, layoutIdSolicitado)).get()
    : layoutActivo();
  if (!layout) throw noEncontrado('Layout');

  const todasLasZonas = db.select().from(zonas).orderBy(asc(zonas.orden), asc(zonas.id)).all();

  const filasMesas = db
    .select({
      id: mesas.id,
      zonaId: mesas.zonaId,
      nombre: mesas.nombre,
      capacidad: mesas.capacidad,
      forma: mesas.forma,
      activa: mesas.activa,
      estado: mesas.estado,
      x: mesaPosiciones.x,
      y: mesaPosiciones.y,
      ancho: mesaPosiciones.ancho,
      alto: mesaPosiciones.alto,
      rotacion: mesaPosiciones.rotacion,
    })
    .from(mesas)
    .leftJoin(mesaPosiciones, and(eq(mesaPosiciones.mesaId, mesas.id), eq(mesaPosiciones.layoutId, layout.id)))
    .orderBy(asc(mesas.id))
    .all();

  const filasElementos = db
    .select()
    .from(elementosPlano)
    .where(eq(elementosPlano.layoutId, layout.id))
    .orderBy(asc(elementosPlano.id))
    .all();

  return {
    layout,
    layouts: listarLayouts(),
    zonas: todasLasZonas.map((zona) => ({
      ...zona,
      mesas: filasMesas
        .filter((m) => m.zonaId === zona.id)
        .map((m) => ({
          ...m,
          // Una mesa sin posición en esta distribución todavía no fue colocada.
          x: m.x ?? 0,
          y: m.y ?? 0,
          ancho: m.ancho ?? 100,
          alto: m.alto ?? 100,
          rotacion: m.rotacion ?? 0,
          colocada: m.x !== null,
        })),
      elementos: filasElementos.filter((e) => e.zonaId === zona.id),
    })),
  };
}

/* ── Zonas ──────────────────────────────────────────────────────────────── */

export function crearZona(datos: ZonaNueva) {
  const orden = datos.orden ?? (db.select({ n: sql<number>`coalesce(max(orden), -1) + 1` }).from(zonas).get()?.n ?? 0);
  return db.insert(zonas).values({ ...datos, orden }).returning().get();
}

export function actualizarZona(id: number, cambios: ZonaCambio) {
  if (Object.keys(cambios).length === 0) return obtenerZona(id);
  const actualizada = db.update(zonas).set(cambios).where(eq(zonas.id, id)).returning().get();
  if (!actualizada) throw noEncontrado('Zona');
  return actualizada;
}

export function obtenerZona(id: number) {
  const zona = db.select().from(zonas).where(eq(zonas.id, id)).get();
  if (!zona) throw noEncontrado('Zona');
  return zona;
}

export function eliminarZona(id: number) {
  const conMesas = db.select({ n: sql<number>`count(*)` }).from(mesas).where(eq(mesas.zonaId, id)).get()?.n ?? 0;
  if (conMesas > 0) throw conflicto('La zona todavía tiene mesas. Muévelas o elimínalas primero.');
  const borrada = db.delete(zonas).where(eq(zonas.id, id)).returning().get();
  if (!borrada) throw noEncontrado('Zona');
  return borrada;
}

/* ── Mesas ──────────────────────────────────────────────────────────────── */

export function crearMesa(datos: MesaNueva, layoutId: number) {
  return db.transaction((tx) => {
    obtenerZona(datos.zonaId);
    const mesa = tx
      .insert(mesas)
      .values({
        zonaId: datos.zonaId,
        nombre: datos.nombre,
        capacidad: datos.capacidad,
        forma: datos.forma,
      })
      .returning()
      .get();

    // La mesa nace en todas las distribuciones; en las demás queda en la misma
    // coordenada hasta que alguien la mueva. Evita mesas "invisibles" al cambiar.
    const geometria = { x: datos.x, y: datos.y, ancho: datos.ancho, alto: datos.alto, rotacion: datos.rotacion };
    const todos = tx.select({ id: layouts.id }).from(layouts).all();
    if (todos.length) {
      tx.insert(mesaPosiciones).values(todos.map((l) => ({ layoutId: l.id, mesaId: mesa.id, ...geometria }))).run();
    }
    return { ...mesa, ...geometria, layoutId };
  });
}

export function actualizarMesa(id: number, cambios: MesaCambio, layoutId: number) {
  return db.transaction((tx) => {
    const mesa = tx.select().from(mesas).where(eq(mesas.id, id)).get();
    if (!mesa) throw noEncontrado('Mesa');

    const atributos: Partial<typeof mesas.$inferInsert> = {};
    for (const campo of ['nombre', 'capacidad', 'forma', 'zonaId', 'activa', 'estado'] as const) {
      if (cambios[campo] !== undefined) Object.assign(atributos, { [campo]: cambios[campo] });
    }
    if (Object.keys(atributos).length) {
      if (atributos.zonaId !== undefined) obtenerZona(atributos.zonaId);
      tx.update(mesas).set(atributos).where(eq(mesas.id, id)).run();
    }

    const geometria: Partial<typeof mesaPosiciones.$inferInsert> = {};
    for (const campo of ['x', 'y', 'ancho', 'alto', 'rotacion'] as const) {
      if (cambios[campo] !== undefined) geometria[campo] = cambios[campo];
    }
    if (Object.keys(geometria).length) {
      guardarGeometriaMesa(tx, layoutId, id, geometria);
    }
    return obtenerMesa(id, layoutId);
  });
}

export function obtenerMesa(id: number, layoutId: number) {
  const fila = db
    .select({
      id: mesas.id,
      zonaId: mesas.zonaId,
      nombre: mesas.nombre,
      capacidad: mesas.capacidad,
      forma: mesas.forma,
      activa: mesas.activa,
      estado: mesas.estado,
      x: mesaPosiciones.x,
      y: mesaPosiciones.y,
      ancho: mesaPosiciones.ancho,
      alto: mesaPosiciones.alto,
      rotacion: mesaPosiciones.rotacion,
    })
    .from(mesas)
    .leftJoin(mesaPosiciones, and(eq(mesaPosiciones.mesaId, mesas.id), eq(mesaPosiciones.layoutId, layoutId)))
    .where(eq(mesas.id, id))
    .get();
  if (!fila) throw noEncontrado('Mesa');
  return fila;
}

export function eliminarMesa(id: number) {
  // Cuando existan órdenes, esto pasará a ser baja lógica (`activa = false`):
  // una mesa con historial de ventas nunca se borra (ver docs/04-modelo-de-datos.md).
  const borrada = db.delete(mesas).where(eq(mesas.id, id)).returning().get();
  if (!borrada) throw noEncontrado('Mesa');
  return borrada;
}

/* ── Elementos decorativos ──────────────────────────────────────────────── */

export function crearElemento(datos: ElementoNuevo, layoutId: number) {
  obtenerZona(datos.zonaId);
  return db.insert(elementosPlano).values({ ...datos, layoutId }).returning().get();
}

export function actualizarElemento(id: number, cambios: ElementoCambio) {
  if (Object.keys(cambios).length === 0) {
    const actual = db.select().from(elementosPlano).where(eq(elementosPlano.id, id)).get();
    if (!actual) throw noEncontrado('Elemento');
    return actual;
  }
  const actualizado = db.update(elementosPlano).set(cambios).where(eq(elementosPlano.id, id)).returning().get();
  if (!actualizado) throw noEncontrado('Elemento');
  return actualizado;
}

export function eliminarElemento(id: number) {
  const borrado = db.delete(elementosPlano).where(eq(elementosPlano.id, id)).returning().get();
  if (!borrado) throw noEncontrado('Elemento');
  return borrado;
}

/* ── Guardado por lote del editor ───────────────────────────────────────── */

/** Guarda de una sola vez todo lo que se movió en el editor. Es una transacción:
 *  o queda el comedor completo, o no queda nada a medias. */
export function guardarPosiciones(layoutId: number, lote: PosicionesLote) {
  return db.transaction((tx) => {
    const layout = tx.select().from(layouts).where(eq(layouts.id, layoutId)).get();
    if (!layout) throw noEncontrado('Layout');

    for (const m of lote.mesas) {
      guardarGeometriaMesa(tx, layoutId, m.id, m);
    }
    for (const e of lote.elementos) {
      tx.update(elementosPlano)
        .set({ x: e.x, y: e.y, ancho: e.ancho, alto: e.alto, rotacion: e.rotacion })
        .where(and(eq(elementosPlano.id, e.id), eq(elementosPlano.layoutId, layoutId)))
        .run();
    }
    return { mesas: lote.mesas.length, elementos: lote.elementos.length };
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Inserta o actualiza la posición de una mesa en una distribución. */
function guardarGeometriaMesa(tx: Tx, layoutId: number, mesaId: number, g: Partial<typeof mesaPosiciones.$inferInsert>) {
  const existente = tx
    .select()
    .from(mesaPosiciones)
    .where(and(eq(mesaPosiciones.layoutId, layoutId), eq(mesaPosiciones.mesaId, mesaId)))
    .get();

  if (existente) {
    tx.update(mesaPosiciones)
      .set(g)
      .where(and(eq(mesaPosiciones.layoutId, layoutId), eq(mesaPosiciones.mesaId, mesaId)))
      .run();
  } else {
    tx.insert(mesaPosiciones).values({ layoutId, mesaId, ...g }).run();
  }
}
