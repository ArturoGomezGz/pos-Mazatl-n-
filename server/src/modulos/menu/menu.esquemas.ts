import { z } from 'zod';
import { ESTACIONES, TIPOS_VENTA } from '../../db/esquema.js';

export const precio = z.number().int().min(0).max(10_000_000); // centavos

export const categoriaNueva = z.object({
  nombre: z.string().trim().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  orden: z.number().int().min(0).max(99).optional(),
});
export const categoriaCambio = categoriaNueva.partial().extend({ activa: z.boolean().optional() });

export const varianteNueva = z.object({
  nombre: z.string().trim().min(1).max(30),
  precioCentavos: precio,
  orden: z.number().int().min(0).max(99).optional(),
});
export const varianteCambio = varianteNueva.partial().extend({ activa: z.boolean().optional() });

export const productoNuevo = z.object({
  categoriaId: z.number().int().positive(),
  nombre: z.string().trim().min(1).max(60),
  descripcion: z.string().trim().max(200).default(''),
  estacion: z.enum(ESTACIONES).default('cocina'),
  tipoVenta: z.enum(TIPOS_VENTA).default('simple'),
  /** Para 'simple', 'peso' y 'abierto': el precio único (o por kilo). */
  precioCentavos: precio.default(0),
  /** Para 'variantes': la lista de tamaños. */
  variantes: z.array(varianteNueva).default([]),
  gruposIds: z.array(z.number().int().positive()).default([]),
  orden: z.number().int().min(0).max(999).optional(),
});

export const productoCambio = z.object({
  categoriaId: z.number().int().positive().optional(),
  nombre: z.string().trim().min(1).max(60).optional(),
  descripcion: z.string().trim().max(200).optional(),
  estacion: z.enum(ESTACIONES).optional(),
  tipoVenta: z.enum(TIPOS_VENTA).optional(),
  precioCentavos: precio.optional(),
  activo: z.boolean().optional(),
  disponibleHoy: z.boolean().optional(),
  orden: z.number().int().min(0).max(999).optional(),
  gruposIds: z.array(z.number().int().positive()).optional(),
});

export const grupoNuevo = z.object({
  nombre: z.string().trim().min(1).max(40),
  minSelecciones: z.number().int().min(0).max(10).default(0),
  maxSelecciones: z.number().int().min(1).max(10).default(1),
  orden: z.number().int().min(0).max(99).optional(),
  modificadores: z
    .array(z.object({ nombre: z.string().trim().min(1).max(40), precioExtraCentavos: precio.default(0) }))
    .default([]),
});

export const grupoCambio = z.object({
  nombre: z.string().trim().min(1).max(40).optional(),
  minSelecciones: z.number().int().min(0).max(10).optional(),
  maxSelecciones: z.number().int().min(1).max(10).optional(),
  orden: z.number().int().min(0).max(99).optional(),
});

export const modificadorNuevo = z.object({
  grupoId: z.number().int().positive(),
  nombre: z.string().trim().min(1).max(40),
  precioExtraCentavos: precio.default(0),
  orden: z.number().int().min(0).max(99).optional(),
});

export const modificadorCambio = modificadorNuevo.partial().omit({ grupoId: true }).extend({
  activo: z.boolean().optional(),
});
