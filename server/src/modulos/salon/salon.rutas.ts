import { Router, type Request } from 'express';
import { noEncontrado } from '../../http/errores.js';
import { idDeRuta, validar } from '../../http/validar.js';
import * as E from './salon.esquemas.js';
import * as salon from './salon.servicio.js';

export const rutasSalon = Router();

/** El editor siempre trabaja sobre una distribución. Si no viene en la URL,
 *  se usa la activa: el caso normal del día a día. */
function layoutDeConsulta(req: Request): number {
  const crudo = req.query.layout;
  if (typeof crudo === 'string' && crudo.length > 0) return idDeRuta(crudo, 'layout');
  const activo = salon.layoutActivo();
  if (!activo) throw noEncontrado('Layout');
  return activo.id;
}

/* Plano completo: lo que consumen el editor y la vista de salón. */
rutasSalon.get('/plano', (req, res) => {
  const crudo = req.query.layout;
  const layoutId = typeof crudo === 'string' && crudo.length > 0 ? idDeRuta(crudo, 'layout') : undefined;
  res.json(salon.obtenerPlano(layoutId));
});

/* Distribuciones */
rutasSalon.get('/layouts', (_req, res) => res.json(salon.listarLayouts()));

rutasSalon.post('/layouts', (req, res) => {
  res.status(201).json(salon.crearLayout(validar(E.layoutNuevo, req.body)));
});

rutasSalon.patch('/layouts/:id', (req, res) => {
  res.json(salon.actualizarLayout(idDeRuta(req.params.id), validar(E.layoutCambio, req.body)));
});

rutasSalon.delete('/layouts/:id', (req, res) => {
  res.json(salon.eliminarLayout(idDeRuta(req.params.id)));
});

/* Zonas */
rutasSalon.post('/zonas', (req, res) => {
  res.status(201).json(salon.crearZona(validar(E.zonaNueva, req.body)));
});

rutasSalon.patch('/zonas/:id', (req, res) => {
  res.json(salon.actualizarZona(idDeRuta(req.params.id), validar(E.zonaCambio, req.body)));
});

rutasSalon.delete('/zonas/:id', (req, res) => {
  res.json(salon.eliminarZona(idDeRuta(req.params.id)));
});

/* Mesas */
rutasSalon.post('/mesas', (req, res) => {
  res.status(201).json(salon.crearMesa(validar(E.mesaNueva, req.body), layoutDeConsulta(req)));
});

rutasSalon.patch('/mesas/:id', (req, res) => {
  res.json(salon.actualizarMesa(idDeRuta(req.params.id), validar(E.mesaCambio, req.body), layoutDeConsulta(req)));
});

rutasSalon.delete('/mesas/:id', (req, res) => {
  res.json(salon.eliminarMesa(idDeRuta(req.params.id)));
});

/* Elementos decorativos */
rutasSalon.post('/elementos', (req, res) => {
  res.status(201).json(salon.crearElemento(validar(E.elementoNuevo, req.body), layoutDeConsulta(req)));
});

rutasSalon.patch('/elementos/:id', (req, res) => {
  res.json(salon.actualizarElemento(idDeRuta(req.params.id), validar(E.elementoCambio, req.body)));
});

rutasSalon.delete('/elementos/:id', (req, res) => {
  res.json(salon.eliminarElemento(idDeRuta(req.params.id)));
});

/* Guardado por lote del editor */
rutasSalon.put('/posiciones', (req, res) => {
  res.json(salon.guardarPosiciones(layoutDeConsulta(req), validar(E.posicionesLote, req.body)));
});
