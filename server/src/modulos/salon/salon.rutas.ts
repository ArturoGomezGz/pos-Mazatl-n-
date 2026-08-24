import { Router, type Request } from 'express';
import { noEncontrado } from '../../http/errores.js';
import { requiereRol, requiereSesion } from '../../http/sesion.js';
import { idDeRuta, validar } from '../../http/validar.js';
import * as E from './salon.esquemas.js';
import * as salon from './salon.servicio.js';

export const rutasSalon = Router();
rutasSalon.use(requiereSesion);

/** Diseñar el comedor es cosa del dueño; verlo y usarlo, de todo el personal. */
const soloAdmin = requiereRol('admin');

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

rutasSalon.post('/layouts', soloAdmin, (req, res) => {
  res.status(201).json(salon.crearLayout(validar(E.layoutNuevo, req.body)));
});

rutasSalon.patch('/layouts/:id', soloAdmin, (req, res) => {
  res.json(salon.actualizarLayout(idDeRuta(req.params.id), validar(E.layoutCambio, req.body)));
});

rutasSalon.delete('/layouts/:id', soloAdmin, (req, res) => {
  res.json(salon.eliminarLayout(idDeRuta(req.params.id)));
});

/* Zonas */
rutasSalon.post('/zonas', soloAdmin, (req, res) => {
  res.status(201).json(salon.crearZona(validar(E.zonaNueva, req.body)));
});

rutasSalon.patch('/zonas/:id', soloAdmin, (req, res) => {
  res.json(salon.actualizarZona(idDeRuta(req.params.id), validar(E.zonaCambio, req.body)));
});

rutasSalon.delete('/zonas/:id', soloAdmin, (req, res) => {
  res.json(salon.eliminarZona(idDeRuta(req.params.id)));
});

/* Mesas */
rutasSalon.post('/mesas', soloAdmin, (req, res) => {
  res.status(201).json(salon.crearMesa(validar(E.mesaNueva, req.body), layoutDeConsulta(req)));
});

/** Detalle de una mesa: lo usa la toma de orden para saber, por ejemplo, si es
 *  un lugar de barra (una sola persona, sin selector de comensales). */
rutasSalon.get('/mesas/:id', (req, res) => {
  res.json(salon.obtenerMesa(idDeRuta(req.params.id), layoutDeConsulta(req)));
});

/** El estado de la mesa (ocupada, por limpiar, libre) lo mueve el piso, no el dueño.
 *  El resto de los atributos —nombre, capacidad, forma, posición— es configuración. */
rutasSalon.post('/mesas/:id/estado', (req, res) => {
  const { estado } = validar(E.mesaCambio.pick({ estado: true }).required(), req.body);
  res.json(salon.actualizarMesa(idDeRuta(req.params.id), { estado }, layoutDeConsulta(req)));
});

rutasSalon.patch('/mesas/:id', soloAdmin, (req, res) => {
  res.json(salon.actualizarMesa(idDeRuta(req.params.id), validar(E.mesaCambio, req.body), layoutDeConsulta(req)));
});

rutasSalon.delete('/mesas/:id', soloAdmin, (req, res) => {
  res.json(salon.eliminarMesa(idDeRuta(req.params.id)));
});

/* Barras (lugares agrupados) */
rutasSalon.post('/barras', soloAdmin, (req, res) => {
  res.status(201).json(salon.crearBarra(validar(E.barraNueva, req.body), layoutDeConsulta(req)));
});

rutasSalon.patch('/barras/:id', soloAdmin, (req, res) => {
  res.json(salon.actualizarBarra(idDeRuta(req.params.id), validar(E.barraCambio, req.body), layoutDeConsulta(req)));
});

rutasSalon.delete('/barras/:id', soloAdmin, (req, res) => {
  res.json(salon.eliminarBarra(idDeRuta(req.params.id)));
});

/* Elementos decorativos */
rutasSalon.post('/elementos', soloAdmin, (req, res) => {
  res.status(201).json(salon.crearElemento(validar(E.elementoNuevo, req.body), layoutDeConsulta(req)));
});

rutasSalon.patch('/elementos/:id', soloAdmin, (req, res) => {
  res.json(salon.actualizarElemento(idDeRuta(req.params.id), validar(E.elementoCambio, req.body)));
});

rutasSalon.delete('/elementos/:id', soloAdmin, (req, res) => {
  res.json(salon.eliminarElemento(idDeRuta(req.params.id)));
});

/* Guardado por lote del editor */
rutasSalon.put('/posiciones', soloAdmin, (req, res) => {
  res.json(salon.guardarPosiciones(layoutDeConsulta(req), validar(E.posicionesLote, req.body)));
});
