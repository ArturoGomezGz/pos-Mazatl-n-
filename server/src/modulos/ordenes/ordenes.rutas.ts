import { Router } from 'express';
import { z } from 'zod';
import { ESTACIONES } from '../../db/esquema.js';
import { requiereSesion, usuarioActual } from '../../http/sesion.js';
import { idDeRuta, validar } from '../../http/validar.js';
import { cuentasDeOrden } from '../cuentas/cuentas.servicio.js';
import * as E from './ordenes.esquemas.js';
import * as ordenes from './ordenes.servicio.js';

export const rutasOrdenes = Router();
rutasOrdenes.use(requiereSesion);

/** La mesa es el punto de entrada del mesero: dime qué hay en esta mesa. */
rutasOrdenes.get('/por-mesa/:mesaId', (req, res) => {
  const orden = ordenes.ordenAbiertaDeMesa(idDeRuta(req.params.mesaId, 'mesaId'));
  res.json(orden ? ordenes.obtenerOrden(orden.id) : null);
});

rutasOrdenes.post('/', (req, res) => {
  const orden = ordenes.abrirOrden(validar(E.ordenNueva, req.body), usuarioActual(req).id);
  res.status(201).json(ordenes.obtenerOrden(orden.id));
});

rutasOrdenes.get('/:id', (req, res) => res.json(ordenes.obtenerOrden(idDeRuta(req.params.id))));

rutasOrdenes.get('/:id/cuentas', (req, res) => res.json(cuentasDeOrden(idDeRuta(req.params.id))));

rutasOrdenes.post('/:id/lineas', (req, res) => {
  res.status(201).json(ordenes.agregarLineas(idDeRuta(req.params.id), validar(E.lineasNuevas, req.body)));
});

rutasOrdenes.patch('/lineas/:id', (req, res) => {
  res.json(ordenes.actualizarLinea(idDeRuta(req.params.id), validar(E.lineaCambio, req.body)));
});

rutasOrdenes.delete('/lineas/:id', (req, res) => {
  res.json(ordenes.eliminarLinea(idDeRuta(req.params.id)));
});

rutasOrdenes.post('/lineas/:id/cancelar', (req, res) => {
  const datos = validar(E.cancelacionLinea, req.body);
  res.json(ordenes.cancelarLinea(idDeRuta(req.params.id), datos, usuarioActual(req).id));
});

rutasOrdenes.post('/:id/enviar', (req, res) => {
  const { claveIdempotencia } = validar(E.envioComanda, req.body ?? {});
  const resultado = ordenes.enviarComanda(idDeRuta(req.params.id), claveIdempotencia);
  res.json({ ...resultado, orden: ordenes.obtenerOrden(idDeRuta(req.params.id)) });
});

rutasOrdenes.post('/:id/transferir', (req, res) => {
  const { mesaDestinoId } = validar(E.transferencia, req.body);
  res.json(ordenes.transferirOrden(idDeRuta(req.params.id), mesaDestinoId, usuarioActual(req).id));
});

/* Pantalla de cocina */
rutasOrdenes.get('/comandas/pendientes', (req, res) => {
  const estacion = validar(z.object({ estacion: z.enum(ESTACIONES).optional() }), { estacion: req.query.estacion });
  res.json(ordenes.comandasPendientes(estacion.estacion));
});

rutasOrdenes.post('/comandas/:id/lista', (req, res) => {
  res.json(ordenes.marcarComandaLista(idDeRuta(req.params.id)));
});
