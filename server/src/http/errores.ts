import type { NextFunction, Request, Response } from 'express';

/** Error con código HTTP explícito. Cualquier otro error es un 500 real. */
export class ErrorHttp extends Error {
  constructor(public readonly estado: number, message: string, public readonly detalle?: unknown) {
    super(message);
    this.name = 'ErrorHttp';
  }
}

export const noEncontrado = (que: string) => new ErrorHttp(404, `${que} no encontrado`);
export const conflicto = (mensaje: string) => new ErrorHttp(409, mensaje);
export const invalido = (mensaje: string, detalle?: unknown) => new ErrorHttp(400, mensaje, detalle);

export function rutaNoEncontrada(_req: Request, res: Response) {
  res.status(404).json({ error: 'Ruta no encontrada' });
}

export function manejadorErrores(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ErrorHttp) {
    res.status(err.estado).json({ error: err.message, detalle: err.detalle });
    return;
  }
  // Violación de índice único de SQLite: la traducimos a algo que el usuario entienda.
  if (err && typeof err === 'object' && 'code' in err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    res.status(409).json({ error: 'Ya existe un registro con ese nombre' });
    return;
  }
  console.error('Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
}
