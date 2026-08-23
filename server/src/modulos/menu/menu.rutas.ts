import { Router } from 'express';
import { z } from 'zod';
import { requiereRol, requiereSesion, usuarioActual } from '../../http/sesion.js';
import { idDeRuta, validar } from '../../http/validar.js';
import { registrar } from '../auth/auth.servicio.js';
import * as E from './menu.esquemas.js';
import * as menu from './menu.servicio.js';

export const rutasMenu = Router();
rutasMenu.use(requiereSesion);

const soloAdmin = requiereRol('admin');

/* Lectura: cualquiera con sesión (el mesero necesita el menú para vender). */
rutasMenu.get('/', (req, res) => {
  res.json(menu.obtenerMenu({ soloVendibles: req.query.completo !== '1' }));
});

rutasMenu.get('/grupos', (_req, res) => res.json(menu.listarGrupos()));

rutasMenu.get('/productos/:id', (req, res) => res.json(menu.obtenerProducto(idDeRuta(req.params.id))));

/* Disponibilidad del día: la puede cambiar cocina y piso, no solo el dueño.
   Quien primero sabe que se acabó el pulpo es el cocinero. */
rutasMenu.post('/productos/:id/disponibilidad', (req, res) => {
  const { disponible } = validar(z.object({ disponible: z.boolean() }), req.body);
  const id = idDeRuta(req.params.id);
  const producto = menu.marcarDisponibilidad(id, disponible);
  registrar(usuarioActual(req).id, disponible ? 'producto_disponible' : 'producto_agotado', 'producto', id, producto.nombre);
  res.json(producto);
});

rutasMenu.post('/reabrir-disponibilidad', requiereRol('admin', 'cajero'), (req, res) => {
  const r = menu.reabrirDisponibilidadDelDia();
  registrar(usuarioActual(req).id, 'disponibilidad_reabierta', 'menu', undefined, `${r.reactivados} producto(s)`);
  res.json(r);
});

/* Escritura del catálogo: solo administración. */
rutasMenu.post('/categorias', soloAdmin, (req, res) => {
  res.status(201).json(menu.crearCategoria(validar(E.categoriaNueva, req.body)));
});
rutasMenu.patch('/categorias/:id', soloAdmin, (req, res) => {
  res.json(menu.actualizarCategoria(idDeRuta(req.params.id), validar(E.categoriaCambio, req.body)));
});
rutasMenu.delete('/categorias/:id', soloAdmin, (req, res) => {
  res.json(menu.eliminarCategoria(idDeRuta(req.params.id)));
});

rutasMenu.post('/productos', soloAdmin, (req, res) => {
  const creado = menu.crearProducto(validar(E.productoNuevo, req.body));
  registrar(usuarioActual(req).id, 'producto_creado', 'producto', creado.id, creado.nombre);
  res.status(201).json(creado);
});
rutasMenu.patch('/productos/:id', soloAdmin, (req, res) => {
  const id = idDeRuta(req.params.id);
  const cambios = validar(E.productoCambio, req.body);
  const actualizado = menu.actualizarProducto(id, cambios);
  if (cambios.precioCentavos !== undefined) {
    registrar(usuarioActual(req).id, 'precio_cambiado', 'producto', id, `${actualizado.nombre}: ${cambios.precioCentavos}`);
  }
  res.json(actualizado);
});
rutasMenu.delete('/productos/:id', soloAdmin, (req, res) => {
  res.json(menu.eliminarProducto(idDeRuta(req.params.id)));
});

rutasMenu.post('/productos/:id/variantes', soloAdmin, (req, res) => {
  res.status(201).json(menu.agregarVariante(idDeRuta(req.params.id), validar(E.varianteNueva, req.body)));
});
rutasMenu.patch('/variantes/:id', soloAdmin, (req, res) => {
  res.json(menu.actualizarVariante(idDeRuta(req.params.id), validar(E.varianteCambio, req.body)));
});
rutasMenu.delete('/variantes/:id', soloAdmin, (req, res) => {
  res.json(menu.eliminarVariante(idDeRuta(req.params.id)));
});

rutasMenu.post('/grupos', soloAdmin, (req, res) => {
  res.status(201).json(menu.crearGrupo(validar(E.grupoNuevo, req.body)));
});
rutasMenu.patch('/grupos/:id', soloAdmin, (req, res) => {
  res.json(menu.actualizarGrupo(idDeRuta(req.params.id), validar(E.grupoCambio, req.body)));
});
rutasMenu.delete('/grupos/:id', soloAdmin, (req, res) => {
  res.json(menu.eliminarGrupo(idDeRuta(req.params.id)));
});

rutasMenu.post('/modificadores', soloAdmin, (req, res) => {
  res.status(201).json(menu.crearModificador(validar(E.modificadorNuevo, req.body)));
});
rutasMenu.patch('/modificadores/:id', soloAdmin, (req, res) => {
  res.json(menu.actualizarModificador(idDeRuta(req.params.id), validar(E.modificadorCambio, req.body)));
});
rutasMenu.delete('/modificadores/:id', soloAdmin, (req, res) => {
  res.json(menu.eliminarModificador(idDeRuta(req.params.id)));
});
