import type { NextFunction, Request, Response } from 'express';
import { ErrorHttp } from './errores.js';
import { usuarioDeToken, type Rol, type UsuarioPublico } from '../modulos/auth/auth.servicio.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: UsuarioPublico;
      token?: string;
    }
  }
}

/** Exige sesión válida. El token viaja en el encabezado Authorization. */
export function requiereSesion(req: Request, _res: Response, next: NextFunction) {
  const encabezado = req.header('authorization') ?? '';
  const token = encabezado.startsWith('Bearer ') ? encabezado.slice(7) : '';
  const usuario = token ? usuarioDeToken(token) : null;
  if (!usuario) throw new ErrorHttp(401, 'Sesión no válida. Vuelve a entrar con tu PIN.');
  req.usuario = usuario;
  req.token = token;
  next();
}

/** Exige que la sesión pertenezca a alguno de los roles indicados. */
export function requiereRol(...roles: Rol[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.usuario) throw new ErrorHttp(401, 'Sesión no válida');
    if (!roles.includes(req.usuario.rol)) {
      throw new ErrorHttp(403, 'Tu rol no tiene permiso para esta acción');
    }
    next();
  };
}

/** Usuario de la petición, ya garantizado por requiereSesion. */
export function usuarioActual(req: Request): UsuarioPublico {
  if (!req.usuario) throw new ErrorHttp(401, 'Sesión no válida');
  return req.usuario;
}
