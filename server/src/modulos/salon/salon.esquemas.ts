import { z } from 'zod';
import { ESTADOS_MESA, FORMAS_MESA, TIPOS_ELEMENTO } from '../../db/esquema.js';

const coordenada = z.number().int().min(-10_000).max(10_000);
const dimension = z.number().int().min(20).max(4_000);
const rotacion = z.number().int().min(0).max(359);

export const geometria = {
  x: coordenada,
  y: coordenada,
  ancho: dimension,
  alto: dimension,
  rotacion,
};

export const zonaNueva = z.object({
  nombre: z.string().trim().min(1).max(40),
  orden: z.number().int().min(0).max(99).optional(),
  ancho: dimension.optional(),
  alto: dimension.optional(),
});

export const zonaCambio = zonaNueva.partial().extend({ activa: z.boolean().optional() });

export const mesaNueva = z.object({
  zonaId: z.number().int().positive(),
  nombre: z.string().trim().min(1).max(20),
  capacidad: z.number().int().min(1).max(30).default(4),
  forma: z.enum(FORMAS_MESA).default('cuadrada'),
  x: coordenada.default(0),
  y: coordenada.default(0),
  ancho: dimension.default(100),
  alto: dimension.default(100),
  rotacion: rotacion.default(0),
});

export const mesaCambio = z.object({
  nombre: z.string().trim().min(1).max(20).optional(),
  capacidad: z.number().int().min(1).max(30).optional(),
  forma: z.enum(FORMAS_MESA).optional(),
  zonaId: z.number().int().positive().optional(),
  activa: z.boolean().optional(),
  estado: z.enum(ESTADOS_MESA).optional(),
  x: coordenada.optional(),
  y: coordenada.optional(),
  ancho: dimension.optional(),
  alto: dimension.optional(),
  rotacion: rotacion.optional(),
});

export const barraNueva = z.object({
  zonaId: z.number().int().positive(),
  lugares: z.number().int().min(1).max(30).default(4),
  x: coordenada.default(0),
  y: coordenada.default(0),
  ancho: dimension.default(280),
  alto: dimension.default(70),
  rotacion: rotacion.default(0),
});

export const barraCambio = z.object({
  lugares: z.number().int().min(1).max(30).optional(),
  zonaId: z.number().int().positive().optional(),
  activa: z.boolean().optional(),
  x: coordenada.optional(),
  y: coordenada.optional(),
  ancho: dimension.optional(),
  alto: dimension.optional(),
  rotacion: rotacion.optional(),
});

export const elementoNuevo = z.object({
  zonaId: z.number().int().positive(),
  tipo: z.enum(TIPOS_ELEMENTO).default('muro'),
  etiqueta: z.string().trim().max(40).default(''),
  x: coordenada.default(0),
  y: coordenada.default(0),
  ancho: dimension.default(160),
  alto: dimension.default(60),
  rotacion: rotacion.default(0),
});

export const elementoCambio = elementoNuevo.partial().omit({ zonaId: true }).extend({
  zonaId: z.number().int().positive().optional(),
});

export const layoutNuevo = z.object({
  nombre: z.string().trim().min(1).max(40),
  copiarDeId: z.number().int().positive().optional(),
});

export const layoutCambio = z.object({
  nombre: z.string().trim().min(1).max(40).optional(),
  activo: z.literal(true).optional(),
});

/** Guardado por lote del editor: una sola petición al presionar "Guardar". */
export const posicionesLote = z.object({
  mesas: z.array(z.object({ id: z.number().int().positive(), ...geometria })).default([]),
  elementos: z.array(z.object({ id: z.number().int().positive(), ...geometria })).default([]),
  barras: z.array(z.object({ id: z.number().int().positive(), ...geometria })).default([]),
});
