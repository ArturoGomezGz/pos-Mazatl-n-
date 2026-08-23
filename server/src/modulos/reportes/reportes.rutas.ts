import { Router } from 'express';
import { z } from 'zod';
import { requiereRol, requiereSesion } from '../../http/sesion.js';
import { validar } from '../../http/validar.js';
import * as reportes from './reportes.servicio.js';

export const rutasReportes = Router();
rutasReportes.use(requiereSesion, requiereRol('admin', 'cajero'));

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hoy = () => new Date().toISOString().slice(0, 10);

function periodo(query: unknown) {
  return validar(z.object({ desde: fecha.default(hoy()), hasta: fecha.default(hoy()) }), query ?? {});
}

rutasReportes.get('/ventas', (req, res) => {
  const { desde, hasta } = periodo(req.query);
  res.json(reportes.ventasDelPeriodo(desde, hasta));
});

rutasReportes.get('/productos', (req, res) => {
  const { desde, hasta } = periodo(req.query);
  res.json(reportes.productosMasVendidos(desde, hasta));
});

rutasReportes.get('/meseros', (req, res) => {
  const { desde, hasta } = periodo(req.query);
  res.json(reportes.ventasPorMesero(desde, hasta));
});

rutasReportes.get('/cancelaciones', (req, res) => {
  const { desde, hasta } = periodo(req.query);
  res.json(reportes.cancelaciones(desde, hasta));
});
