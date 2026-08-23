import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import { config } from './config.js';
import { manejadorErrores, rutaNoEncontrada } from './http/errores.js';
import { rutasSalon } from './modulos/salon/salon.rutas.js';

export function crearApp() {
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(cors({ origin: config.corsOrigen }));
  if (config.entorno !== 'test') app.use(morgan('dev'));

  app.get('/api/salud', (_req, res) => res.json({ ok: true, entorno: config.entorno }));
  app.use('/api/salon', rutasSalon);

  app.use(rutaNoEncontrada);
  app.use(manejadorErrores);

  return app;
}
