import { crearApp } from './app.js';
import { config } from './config.js';
import { migrar } from './db/migrar.js';
import { sembrar } from './db/semilla.js';

// Migrar y sembrar al arrancar: en el restaurante nadie va a ejecutar comandos
// de mantenimiento. sembrar() es idempotente, así que no duplica datos si ya existen.
const aplicadas = migrar();
if (aplicadas.length) console.log(`Base de datos actualizada (${aplicadas.length} migración/es).`);
sembrar();

crearApp().listen(config.puerto, () => {
  console.log(`API de Mariscos Mazatlán escuchando en http://localhost:${config.puerto}`);
  console.log(`Base de datos: ${config.dbRuta}`);
});
