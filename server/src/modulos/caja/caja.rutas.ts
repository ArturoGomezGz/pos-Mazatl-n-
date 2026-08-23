import { Router } from 'express';
import { z } from 'zod';
import { TIPOS_MOVIMIENTO } from '../../db/esquema.js';
import { requiereRol, requiereSesion, usuarioActual } from '../../http/sesion.js';
import { idDeRuta, validar } from '../../http/validar.js';
import * as caja from './caja.servicio.js';

export const rutasCaja = Router();
rutasCaja.use(requiereSesion);

const centavos = z.number().int().min(0).max(100_000_000);
const soloCaja = requiereRol('admin', 'cajero');

rutasCaja.get('/turno-actual', (_req, res) => {
  const turno = caja.turnoAbierto();
  res.json(turno ? caja.resumenTurno(turno.id) : null);
});

rutasCaja.get('/turnos', soloCaja, (_req, res) => res.json(caja.listarTurnos()));

rutasCaja.get('/turnos/:id', soloCaja, (req, res) => res.json(caja.resumenTurno(idDeRuta(req.params.id))));

rutasCaja.post('/turnos', soloCaja, (req, res) => {
  const { fondoInicialCentavos } = validar(z.object({ fondoInicialCentavos: centavos }), req.body);
  res.status(201).json(caja.abrirTurno(usuarioActual(req).id, fondoInicialCentavos));
});

rutasCaja.post('/movimientos', soloCaja, (req, res) => {
  const datos = validar(
    z.object({
      tipo: z.enum(TIPOS_MOVIMIENTO),
      montoCentavos: centavos.refine((v) => v > 0, 'El monto debe ser mayor a cero'),
      concepto: z.string().trim().min(1).max(120),
    }),
    req.body,
  );
  res.status(201).json(caja.registrarMovimiento({ ...datos, usuarioId: usuarioActual(req).id }));
});

rutasCaja.post('/turnos/:id/cerrar', soloCaja, (req, res) => {
  const { declaradoCentavos } = validar(z.object({ declaradoCentavos: centavos }), req.body);
  res.json(caja.cerrarTurno(idDeRuta(req.params.id), declaradoCentavos, usuarioActual(req).id));
});
