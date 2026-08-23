import { z } from 'zod';
import { METODOS_PAGO } from '../../db/esquema.js';

const centavos = z.number().int().min(0).max(100_000_000);
const pin = z.string().regex(/^\d{4,6}$/);

export const cuentaNueva = z.object({
  nombre: z.string().trim().min(1).max(30).optional(),
});

export const asignacion = z.object({
  lineaId: z.number().int().positive(),
  cuentaId: z.number().int().positive(),
  /** 1000 = la línea completa; 500 = la mitad (lo que compartieron). */
  proporcionMilesimas: z.number().int().min(1).max(1000).default(1000),
  /** Si es true, la línea deja de estar en las demás cuentas. */
  exclusiva: z.boolean().default(true),
});

export const division = z.object({
  partes: z.number().int().min(2).max(20),
});

export const descuento = z.object({
  tipo: z.enum(['monto', 'porcentaje']),
  valor: z.number().int().min(0).max(100_000_000),
  motivo: z.string().trim().min(3).max(120),
  pinAutorizacion: pin,
});

export const propina = z.object({
  propinaCentavos: centavos,
});

export const pagoNuevo = z.object({
  metodo: z.enum(METODOS_PAGO),
  montoCentavos: centavos,
  referencia: z.string().trim().max(60).default(''),
  recibidoCentavos: centavos.optional(),
});

export const cobro = z.object({
  pagos: z.array(pagoNuevo).min(1).max(6),
  claveIdempotencia: z.string().trim().min(8).max(80).optional(),
});

export const reapertura = z.object({
  motivo: z.string().trim().min(3).max(120),
  pinAutorizacion: pin,
});
