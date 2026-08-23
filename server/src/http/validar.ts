import type { ZodType } from 'zod';
import { invalido } from './errores.js';

/** Valida el cuerpo de la petición contra un esquema Zod y devuelve el dato tipado. */
export function validar<T>(esquema: ZodType<T>, dato: unknown): T {
  const resultado = esquema.safeParse(dato);
  if (!resultado.success) {
    const detalle = resultado.error.issues.map((i) => ({
      campo: i.path.join('.') || '(raíz)',
      mensaje: i.message,
    }));
    throw invalido('Datos inválidos', detalle);
  }
  return resultado.data;
}

/** Convierte un parámetro de ruta en entero positivo o lanza 400. */
export function idDeRuta(valor: string | undefined, nombre = 'id'): number {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) throw invalido(`El parámetro ${nombre} debe ser un entero positivo`);
  return n;
}
