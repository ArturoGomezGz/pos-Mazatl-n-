import { Router } from 'express';
import { requiereRol, requiereSesion, usuarioActual } from '../../http/sesion.js';
import { idDeRuta, validar } from '../../http/validar.js';
import * as E from './cuentas.esquemas.js';
import * as cuentas from './cuentas.servicio.js';

export const rutasCuentas = Router();
rutasCuentas.use(requiereSesion);

rutasCuentas.post('/orden/:ordenId', (req, res) => {
  const { nombre } = validar(E.cuentaNueva, req.body ?? {});
  res.status(201).json(cuentas.crearCuenta(idDeRuta(req.params.ordenId, 'ordenId'), nombre));
});

rutasCuentas.delete('/:id', (req, res) => res.json(cuentas.eliminarCuenta(idDeRuta(req.params.id))));

rutasCuentas.post('/asignar', (req, res) => {
  res.json(cuentas.asignarLinea(validar(E.asignacion, req.body)));
});

rutasCuentas.post('/repartir', (req, res) => {
  res.json(cuentas.repartirLinea(validar(E.reparto, req.body)));
});

rutasCuentas.post('/mover', (req, res) => {
  res.json(cuentas.moverUnidades(validar(E.movimiento, req.body)));
});

rutasCuentas.post('/orden/:ordenId/dividir', (req, res) => {
  const { partes } = validar(E.division, req.body);
  res.json(cuentas.dividirEnPartesIguales(idDeRuta(req.params.ordenId, 'ordenId'), partes));
});

rutasCuentas.post('/:id/descuento', (req, res) => {
  res.json(cuentas.aplicarDescuento(idDeRuta(req.params.id), validar(E.descuento, req.body), usuarioActual(req).id));
});

rutasCuentas.post('/:id/propina', (req, res) => {
  const { propinaCentavos } = validar(E.propina, req.body);
  res.json(cuentas.establecerPropina(idDeRuta(req.params.id), propinaCentavos));
});

/* Cobrar es cosa de caja: el mesero pide la cuenta, el cajero la cobra. */
rutasCuentas.post('/:id/cobrar', requiereRol('admin', 'cajero'), (req, res) => {
  res.json(cuentas.cobrar(idDeRuta(req.params.id), validar(E.cobro, req.body), usuarioActual(req).id));
});

rutasCuentas.post('/:id/reabrir', requiereRol('admin'), (req, res) => {
  res.json(cuentas.reabrirCuenta(idDeRuta(req.params.id), validar(E.reapertura, req.body), usuarioActual(req).id));
});
