import { sql } from 'drizzle-orm';
import { sqliteTable, integer, text, primaryKey } from 'drizzle-orm/sqlite-core';

/** Estados posibles de una mesa durante el servicio. */
export const ESTADOS_MESA = ['libre', 'ocupada', 'cuenta_pedida', 'por_limpiar', 'reservada'] as const;
export const FORMAS_MESA = ['cuadrada', 'redonda', 'rectangular', 'barra'] as const;
export const TIPOS_ELEMENTO = ['muro', 'barra', 'cocina', 'bano', 'planta', 'texto'] as const;

export const zonas = sqliteTable('zonas', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nombre: text('nombre').notNull(),
  orden: integer('orden').notNull().default(0),
  activa: integer('activa', { mode: 'boolean' }).notNull().default(true),
  ancho: integer('ancho').notNull().default(1200),
  alto: integer('alto').notNull().default(800),
  creadoEn: text('creado_en').notNull().default(sql`(datetime('now'))`),
});

export const layouts = sqliteTable('layouts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nombre: text('nombre').notNull(),
  activo: integer('activo', { mode: 'boolean' }).notNull().default(false),
  creadoEn: text('creado_en').notNull().default(sql`(datetime('now'))`),
});

export const mesas = sqliteTable('mesas', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  zonaId: integer('zona_id').notNull().references(() => zonas.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
  capacidad: integer('capacidad').notNull().default(4),
  forma: text('forma', { enum: FORMAS_MESA }).notNull().default('cuadrada'),
  activa: integer('activa', { mode: 'boolean' }).notNull().default(true),
  estado: text('estado', { enum: ESTADOS_MESA }).notNull().default('libre'),
  creadoEn: text('creado_en').notNull().default(sql`(datetime('now'))`),
});

export const mesaPosiciones = sqliteTable('mesa_posiciones', {
  layoutId: integer('layout_id').notNull().references(() => layouts.id, { onDelete: 'cascade' }),
  mesaId: integer('mesa_id').notNull().references(() => mesas.id, { onDelete: 'cascade' }),
  x: integer('x').notNull().default(0),
  y: integer('y').notNull().default(0),
  ancho: integer('ancho').notNull().default(100),
  alto: integer('alto').notNull().default(100),
  rotacion: integer('rotacion').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.layoutId, t.mesaId] })]);

export const elementosPlano = sqliteTable('elementos_plano', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  layoutId: integer('layout_id').notNull().references(() => layouts.id, { onDelete: 'cascade' }),
  zonaId: integer('zona_id').notNull().references(() => zonas.id, { onDelete: 'cascade' }),
  tipo: text('tipo', { enum: TIPOS_ELEMENTO }).notNull().default('muro'),
  etiqueta: text('etiqueta').notNull().default(''),
  x: integer('x').notNull().default(0),
  y: integer('y').notNull().default(0),
  ancho: integer('ancho').notNull().default(160),
  alto: integer('alto').notNull().default(60),
  rotacion: integer('rotacion').notNull().default(0),
});
