import { z } from 'zod';

export const claveIdempotencia = z.string().trim().min(8).max(80);

export const ordenNueva = z.object({
  mesaId: z.number().int().positive(),
  comensales: z.number().int().min(1).max(60).default(1),
});

export const lineaNueva = z.object({
  varianteId: z.number().int().positive(),
  /** 1000 = una pieza. Para venta por peso: 1500 = 1.5 kg. */
  cantidadMilesimas: z.number().int().min(1).max(1_000_000).default(1000),
  nota: z.string().trim().max(120).default(''),
  modificadoresIds: z.array(z.number().int().positive()).default([]),
  /** Solo para productos de precio abierto (precio del día). */
  precioCentavos: z.number().int().min(0).max(10_000_000).optional(),
});

export const lineasNuevas = z.object({
  lineas: z.array(lineaNueva).min(1).max(60),
  cuentaId: z.number().int().positive().optional(),
});

export const lineaCambio = z.object({
  cantidadMilesimas: z.number().int().min(1).max(1_000_000).optional(),
  nota: z.string().trim().max(120).optional(),
});

export const envioComanda = z.object({
  claveIdempotencia: claveIdempotencia.optional(),
});

export const cancelacionLinea = z.object({
  motivo: z.string().trim().min(3).max(120),
  pinAutorizacion: z.string().regex(/^\d{4,6}$/),
  esCortesia: z.boolean().default(false),
});

export const transferencia = z.object({
  mesaDestinoId: z.number().int().positive(),
});
