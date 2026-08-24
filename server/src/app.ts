import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { manejadorErrores, rutaNoEncontrada } from './http/errores.js';
import { rutasAuth } from './modulos/auth/auth.rutas.js';
import { rutasCaja } from './modulos/caja/caja.rutas.js';
import { rutasConfig } from './modulos/config/config.rutas.js';
import { rutasCuentas } from './modulos/cuentas/cuentas.rutas.js';
import { rutasMenu } from './modulos/menu/menu.rutas.js';
import { rutasOrdenes } from './modulos/ordenes/ordenes.rutas.js';
import { rutasReportes } from './modulos/reportes/reportes.rutas.js';
import { rutasSalon } from './modulos/salon/salon.rutas.js';

export function crearApp() {
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(cors({ origin: config.corsOrigen }));
  if (config.entorno !== 'test') app.use(morgan('dev'));

  app.get('/api/salud', (_req, res) => res.json({ ok: true, entorno: config.entorno }));
  app.use('/api/auth', rutasAuth);
  app.use('/api/salon', rutasSalon);
  app.use('/api/menu', rutasMenu);
  app.use('/api/ordenes', rutasOrdenes);
  app.use('/api/cuentas', rutasCuentas);
  app.use('/api/caja', rutasCaja);
  app.use('/api/reportes', rutasReportes);
  app.use('/api/config', rutasConfig);

  // Sirve el build del cliente cuando existe (deploy de un solo servicio, p. ej. Railway).
  // En desarrollo el cliente corre aparte con Vite, así que esta carpeta no existe.
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const distCliente = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(distCliente)) {
    app.use(express.static(distCliente));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distCliente, 'index.html'));
    });
  }

  app.use(rutaNoEncontrada);
  app.use(manejadorErrores);

  return app;
}
