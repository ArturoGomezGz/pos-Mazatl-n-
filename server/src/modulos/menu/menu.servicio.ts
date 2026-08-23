import { asc, eq, inArray, sql } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { z } from 'zod';
import { db } from '../../db/cliente.js';
import {
  categorias,
  gruposModificadores,
  modificadores,
  productoGrupos,
  productos,
  variantes,
} from '../../db/esquema.js';
import { conflicto, invalido, noEncontrado } from '../../http/errores.js';
import type * as E from './menu.esquemas.js';

type ProductoNuevo = z.infer<typeof E.productoNuevo>;
type ProductoCambio = z.infer<typeof E.productoCambio>;
type CategoriaNueva = z.infer<typeof E.categoriaNueva>;
type CategoriaCambio = z.infer<typeof E.categoriaCambio>;
type VarianteNueva = z.infer<typeof E.varianteNueva>;
type VarianteCambio = z.infer<typeof E.varianteCambio>;
type GrupoNuevo = z.infer<typeof E.grupoNuevo>;
type GrupoCambio = z.infer<typeof E.grupoCambio>;
type ModificadorNuevo = z.infer<typeof E.modificadorNuevo>;
type ModificadorCambio = z.infer<typeof E.modificadorCambio>;

/* ── Consulta del menú ───────────────────────────────────────────────── */

/** El menú completo, listo para pintarse. Una sola petición: el menú de un
 *  restaurante pequeño son unos pocos KB y la tablet lo necesita entero. */
export function obtenerMenu(opciones: { soloVendibles?: boolean } = {}) {
  const cats = db.select().from(categorias).orderBy(asc(categorias.orden), asc(categorias.id)).all();
  const prods = db.select().from(productos).orderBy(asc(productos.orden), asc(productos.id)).all();
  const vars = db.select().from(variantes).orderBy(asc(variantes.orden), asc(variantes.id)).all();
  const grupos = listarGrupos();
  const asignaciones = db.select().from(productoGrupos).orderBy(asc(productoGrupos.orden)).all();

  const visibles = opciones.soloVendibles ? cats.filter((c) => c.activa) : cats;

  return visibles.map((categoria) => ({
    ...categoria,
    productos: prods
      .filter((p) => p.categoriaId === categoria.id && (!opciones.soloVendibles || p.activo))
      .map((producto) => ({
        ...producto,
        variantes: vars.filter((v) => v.productoId === producto.id && (!opciones.soloVendibles || v.activa)),
        grupos: asignaciones
          .filter((a) => a.productoId === producto.id)
          .map((a) => grupos.find((g) => g.id === a.grupoId))
          .filter((g): g is (typeof grupos)[number] => Boolean(g)),
      })),
  }));
}

export function listarGrupos() {
  const grupos = db.select().from(gruposModificadores).orderBy(asc(gruposModificadores.orden), asc(gruposModificadores.id)).all();
  const mods = db.select().from(modificadores).orderBy(asc(modificadores.orden), asc(modificadores.id)).all();
  return grupos.map((g) => ({ ...g, modificadores: mods.filter((m) => m.grupoId === g.id) }));
}

/* ── Categorías ──────────────────────────────────────────────────────── */

export function crearCategoria(datos: CategoriaNueva) {
  const orden = datos.orden ?? siguienteOrden(categorias, categorias.orden);
  return db.insert(categorias).values({ ...datos, orden }).returning().get();
}

export function actualizarCategoria(id: number, cambios: CategoriaCambio) {
  if (!Object.keys(cambios).length) return obtenerCategoria(id);
  const actualizada = db.update(categorias).set(cambios).where(eq(categorias.id, id)).returning().get();
  if (!actualizada) throw noEncontrado('Categoría');
  return actualizada;
}

function obtenerCategoria(id: number) {
  const categoria = db.select().from(categorias).where(eq(categorias.id, id)).get();
  if (!categoria) throw noEncontrado('Categoría');
  return categoria;
}

export function eliminarCategoria(id: number) {
  const n = db.select({ n: sql<number>`count(*)` }).from(productos).where(eq(productos.categoriaId, id)).get()?.n ?? 0;
  if (n > 0) throw conflicto('La categoría todavía tiene productos. Muévelos o elimínalos primero.');
  const borrada = db.delete(categorias).where(eq(categorias.id, id)).returning().get();
  if (!borrada) throw noEncontrado('Categoría');
  return borrada;
}

/* ── Productos ───────────────────────────────────────────────────────── */

/** Regla central del menú flexible: **todo producto tiene al menos una variante**,
 *  incluso los de precio único. Así el resto del sistema (orden, cuenta, ticket)
 *  tiene una sola forma de leer un precio, sea cual sea el estilo del menú. */
export function crearProducto(datos: ProductoNuevo) {
  return db.transaction((tx) => {
    obtenerCategoria(datos.categoriaId);
    const unidad = datos.tipoVenta === 'peso' ? 'kg' : 'pieza';
    const producto = tx
      .insert(productos)
      .values({
        categoriaId: datos.categoriaId,
        nombre: datos.nombre,
        descripcion: datos.descripcion,
        estacion: datos.estacion,
        tipoVenta: datos.tipoVenta,
        unidad,
        orden: datos.orden ?? siguienteOrden(productos, productos.orden),
      })
      .returning()
      .get();

    for (const v of variantesIniciales(datos)) {
      tx.insert(variantes).values({ ...v, productoId: producto.id }).run();
    }
    asignarGrupos(tx, producto.id, datos.gruposIds);
    return obtenerProducto(producto.id);
  });
}

function variantesIniciales(datos: ProductoNuevo): VarianteNueva[] {
  if (datos.tipoVenta === 'variantes') {
    if (datos.variantes.length === 0) throw invalido('Un producto con tamaños necesita al menos una variante');
    return datos.variantes;
  }
  const nombre = { simple: 'Único', peso: 'Por kilo', abierto: 'Precio del día' }[datos.tipoVenta] ?? 'Único';
  return [{ nombre, precioCentavos: datos.precioCentavos, orden: 0 }];
}

export function obtenerProducto(id: number) {
  const producto = db.select().from(productos).where(eq(productos.id, id)).get();
  if (!producto) throw noEncontrado('Producto');
  const grupos = listarGrupos();
  const asignados = db.select().from(productoGrupos).where(eq(productoGrupos.productoId, id)).all();
  return {
    ...producto,
    variantes: db.select().from(variantes).where(eq(variantes.productoId, id)).orderBy(asc(variantes.orden)).all(),
    grupos: asignados.map((a) => grupos.find((g) => g.id === a.grupoId)).filter(Boolean),
  };
}

export function actualizarProducto(id: number, cambios: ProductoCambio) {
  return db.transaction((tx) => {
    const actual = tx.select().from(productos).where(eq(productos.id, id)).get();
    if (!actual) throw noEncontrado('Producto');

    const set: Partial<typeof productos.$inferInsert> = {};
    for (const campo of ['categoriaId', 'nombre', 'descripcion', 'estacion', 'activo', 'disponibleHoy', 'orden'] as const) {
      if (cambios[campo] !== undefined) Object.assign(set, { [campo]: cambios[campo] });
    }

    // Cambiar el estilo de venta reorganiza las variantes, no las borra a ciegas.
    if (cambios.tipoVenta && cambios.tipoVenta !== actual.tipoVenta) {
      set.tipoVenta = cambios.tipoVenta;
      set.unidad = cambios.tipoVenta === 'peso' ? 'kg' : 'pieza';
      if (cambios.tipoVenta !== 'variantes') {
        const existentes = tx.select().from(variantes).where(eq(variantes.productoId, id)).orderBy(asc(variantes.orden)).all();
        const primera = existentes[0];
        const nombre = { simple: 'Único', peso: 'Por kilo', abierto: 'Precio del día' }[cambios.tipoVenta] ?? 'Único';
        const precio = cambios.precioCentavos ?? primera?.precioCentavos ?? 0;
        if (primera) {
          tx.update(variantes).set({ nombre, precioCentavos: precio, activa: true }).where(eq(variantes.id, primera.id)).run();
          const sobrantes = existentes.slice(1).map((v) => v.id);
          if (sobrantes.length) tx.update(variantes).set({ activa: false }).where(inArray(variantes.id, sobrantes)).run();
        } else {
          tx.insert(variantes).values({ productoId: id, nombre, precioCentavos: precio }).run();
        }
      }
    } else if (cambios.precioCentavos !== undefined && actual.tipoVenta !== 'variantes') {
      const primera = tx.select().from(variantes).where(eq(variantes.productoId, id)).orderBy(asc(variantes.orden)).get();
      if (primera) tx.update(variantes).set({ precioCentavos: cambios.precioCentavos }).where(eq(variantes.id, primera.id)).run();
    }

    if (Object.keys(set).length) tx.update(productos).set(set).where(eq(productos.id, id)).run();
    if (cambios.gruposIds) {
      tx.delete(productoGrupos).where(eq(productoGrupos.productoId, id)).run();
      asignarGrupos(tx, id, cambios.gruposIds);
    }
    return obtenerProducto(id);
  });
}

export function eliminarProducto(id: number) {
  // Baja lógica: el producto puede aparecer en tickets viejos.
  const actualizado = db.update(productos).set({ activo: false }).where(eq(productos.id, id)).returning().get();
  if (!actualizado) throw noEncontrado('Producto');
  return actualizado;
}

/** El botón más usado del servicio: se acabó el pulpo y hay que avisar al piso ya. */
export function marcarDisponibilidad(id: number, disponible: boolean) {
  const actualizado = db.update(productos).set({ disponibleHoy: disponible }).where(eq(productos.id, id)).returning().get();
  if (!actualizado) throw noEncontrado('Producto');
  return actualizado;
}

/** Al abrir el día, todo vuelve a estar disponible. */
export function reabrirDisponibilidadDelDia() {
  const r = db.update(productos).set({ disponibleHoy: true }).where(eq(productos.disponibleHoy, false)).returning().all();
  return { reactivados: r.length };
}

/* ── Variantes ───────────────────────────────────────────────────────── */

export function agregarVariante(productoId: number, datos: VarianteNueva) {
  const producto = db.select().from(productos).where(eq(productos.id, productoId)).get();
  if (!producto) throw noEncontrado('Producto');
  if (producto.tipoVenta !== 'variantes') {
    throw conflicto('Este producto no maneja tamaños. Cámbialo a “varios tamaños” para agregarlos.');
  }
  return db
    .insert(variantes)
    .values({ ...datos, productoId, orden: datos.orden ?? siguienteOrden(variantes, variantes.orden) })
    .returning()
    .get();
}

export function actualizarVariante(id: number, cambios: VarianteCambio) {
  const actualizada = db.update(variantes).set(cambios).where(eq(variantes.id, id)).returning().get();
  if (!actualizada) throw noEncontrado('Variante');
  return actualizada;
}

export function eliminarVariante(id: number) {
  const variante = db.select().from(variantes).where(eq(variantes.id, id)).get();
  if (!variante) throw noEncontrado('Variante');
  const hermanas = db.select().from(variantes).where(eq(variantes.productoId, variante.productoId)).all();
  if (hermanas.length <= 1) throw conflicto('El producto debe conservar al menos un precio');
  return db.delete(variantes).where(eq(variantes.id, id)).returning().get();
}

/* ── Grupos de modificadores ─────────────────────────────────────────── */

export function crearGrupo(datos: GrupoNuevo) {
  return db.transaction((tx) => {
    const grupo = tx
      .insert(gruposModificadores)
      .values({
        nombre: datos.nombre,
        minSelecciones: datos.minSelecciones,
        maxSelecciones: Math.max(datos.maxSelecciones, datos.minSelecciones),
        orden: datos.orden ?? siguienteOrden(gruposModificadores, gruposModificadores.orden),
      })
      .returning()
      .get();
    datos.modificadores.forEach((m, i) => {
      tx.insert(modificadores).values({ ...m, grupoId: grupo.id, orden: i }).run();
    });
    return grupo;
  });
}

export function actualizarGrupo(id: number, cambios: GrupoCambio) {
  const actualizado = db.update(gruposModificadores).set(cambios).where(eq(gruposModificadores.id, id)).returning().get();
  if (!actualizado) throw noEncontrado('Grupo de modificadores');
  return actualizado;
}

export function eliminarGrupo(id: number) {
  const borrado = db.delete(gruposModificadores).where(eq(gruposModificadores.id, id)).returning().get();
  if (!borrado) throw noEncontrado('Grupo de modificadores');
  return borrado;
}

export function crearModificador(datos: ModificadorNuevo) {
  return db.insert(modificadores).values({ ...datos, orden: datos.orden ?? siguienteOrden(modificadores, modificadores.orden) }).returning().get();
}

export function actualizarModificador(id: number, cambios: ModificadorCambio) {
  const actualizado = db.update(modificadores).set(cambios).where(eq(modificadores.id, id)).returning().get();
  if (!actualizado) throw noEncontrado('Modificador');
  return actualizado;
}

export function eliminarModificador(id: number) {
  const borrado = db.delete(modificadores).where(eq(modificadores.id, id)).returning().get();
  if (!borrado) throw noEncontrado('Modificador');
  return borrado;
}

/* ── Utilidades ──────────────────────────────────────────────────────── */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function asignarGrupos(tx: Tx, productoId: number, gruposIds: number[]) {
  gruposIds.forEach((grupoId, i) => {
    tx.insert(productoGrupos).values({ productoId, grupoId, orden: i }).run();
  });
}

function siguienteOrden(tabla: SQLiteTable, columna: SQLiteColumn) {
  return db.select({ n: sql<number>`coalesce(max(${columna}), -1) + 1` }).from(tabla).get()?.n ?? 0;
}
