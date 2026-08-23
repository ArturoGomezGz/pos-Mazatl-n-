import { Router } from 'express';
import { z } from 'zod';
import { requiereRol, requiereSesion, usuarioActual } from '../../http/sesion.js';
import { validar } from '../../http/validar.js';
import { registrar } from '../auth/auth.servicio.js';
import * as cfg from './config.servicio.js';

export const rutasConfig = Router();
rutasConfig.use(requiereSesion);

rutasConfig.get('/', (_req, res) => res.json(cfg.obtenerConfig()));

rutasConfig.put('/', requiereRol('admin'), (req, res) => {
  const cambios = validar(z.record(z.string().min(1).max(60), z.string().max(200)), req.body);
  const guardada = cfg.guardarConfig(cambios);
  registrar(usuarioActual(req).id, 'config_actualizada', 'config', undefined, Object.keys(cambios).join(', '));
  res.json(guardada);
});
