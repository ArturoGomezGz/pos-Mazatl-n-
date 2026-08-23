import { Router } from 'express';
import { z } from 'zod';
import { requiereRol, requiereSesion, usuarioActual } from '../../http/sesion.js';
import { idDeRuta, validar } from '../../http/validar.js';
import { ROLES } from '../../db/esquema.js';
import * as auth from './auth.servicio.js';

export const rutasAuth = Router();

const pin = z.string().regex(/^\d{4,6}$/, 'El PIN debe tener de 4 a 6 dígitos');

/* Público: la pantalla de ingreso muestra quién está trabajando. Nunca expone el PIN. */
rutasAuth.get('/usuarios-activos', (_req, res) => {
  res.json(auth.listarUsuarios(true).map((u) => ({ id: u.id, nombre: u.nombre, rol: u.rol })));
});

rutasAuth.post('/ingresar', (req, res) => {
  const datos = validar(z.object({ usuarioId: z.number().int().positive(), pin }), req.body);
  res.json(auth.ingresar(datos.usuarioId, datos.pin));
});

rutasAuth.post('/salir', requiereSesion, (req, res) => {
  auth.salir(req.token!);
  res.json({ ok: true });
});

rutasAuth.get('/yo', requiereSesion, (req, res) => res.json(usuarioActual(req)));

/* Administración de usuarios */
rutasAuth.get('/usuarios', requiereSesion, requiereRol('admin'), (_req, res) => {
  res.json(auth.listarUsuarios());
});

rutasAuth.post('/usuarios', requiereSesion, requiereRol('admin'), (req, res) => {
  const datos = validar(
    z.object({ nombre: z.string().trim().min(1).max(40), rol: z.enum(ROLES), pin }),
    req.body,
  );
  const creado = auth.crearUsuario(datos);
  auth.registrar(usuarioActual(req).id, 'usuario_creado', 'usuario', creado.id, `${creado.nombre} (${creado.rol})`);
  res.status(201).json(creado);
});

rutasAuth.patch('/usuarios/:id', requiereSesion, requiereRol('admin'), (req, res) => {
  const cambios = validar(
    z.object({
      nombre: z.string().trim().min(1).max(40).optional(),
      rol: z.enum(ROLES).optional(),
      pin: pin.optional(),
      activo: z.boolean().optional(),
    }),
    req.body,
  );
  const id = idDeRuta(req.params.id);
  const actualizado = auth.actualizarUsuario(id, cambios);
  auth.registrar(usuarioActual(req).id, 'usuario_actualizado', 'usuario', id, Object.keys(cambios).join(', '));
  res.json(actualizado);
});

rutasAuth.get('/bitacora', requiereSesion, requiereRol('admin'), (_req, res) => {
  res.json(auth.listarBitacora());
});
