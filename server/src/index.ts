import { crearApp } from './app.js';
import { config } from './config.js';
import { migrar } from './db/migrar.js';

// Migrar al arrancar: en el restaurante nadie va a ejecutar comandos de mantenimiento.
const aplicadas = migrar();
if (aplicadas.length) console.log(`Base de datos actualizada (${aplicadas.length} migración/es).`);

crearApp().listen(config.puerto, () => {
  console.log(`API de Mariscos Mazatlán escuchando en http://localhost:${config.puerto}`);
  console.log(`Base de datos: ${config.dbRuta}`);
});
