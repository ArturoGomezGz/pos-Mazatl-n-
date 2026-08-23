import { db } from './cliente.js';
import { elementosPlano, layouts, mesaPosiciones, mesas, zonas } from './esquema.js';
import { migrar } from './migrar.js';

/** Datos de arranque: un comedor de ejemplo parecido al de Mariscos Mazatlán,
 *  para poder probar el editor y la vista de salón desde el primer minuto. */
migrar();

const yaHayZonas = db.select().from(zonas).all().length > 0;
if (yaHayZonas) {
  console.log('La base ya tiene datos. No se hace nada.');
  process.exit(0);
}

db.transaction((tx) => {
  const layout = tx.insert(layouts).values({ nombre: 'Normal', activo: true }).returning().get();

  const crearZona = (nombre: string, orden: number, ancho: number, alto: number) =>
    tx.insert(zonas).values({ nombre, orden, ancho, alto }).returning().get();

  const terraza = crearZona('Terraza', 0, 1200, 760);
  const salon = crearZona('Salón', 1, 1200, 760);
  const palapa = crearZona('Palapa', 2, 900, 700);

  const crearMesa = (
    zonaId: number,
    nombre: string,
    capacidad: number,
    forma: 'cuadrada' | 'redonda' | 'rectangular' | 'barra',
    x: number,
    y: number,
    ancho = 110,
    alto = 110,
  ) => {
    const mesa = tx.insert(mesas).values({ zonaId, nombre, capacidad, forma }).returning().get();
    tx.insert(mesaPosiciones).values({ layoutId: layout.id, mesaId: mesa.id, x, y, ancho, alto }).run();
    return mesa;
  };

  // Terraza: mesas al frente, vista al mar.
  crearMesa(terraza.id, 'T-1', 4, 'cuadrada', 80, 100);
  crearMesa(terraza.id, 'T-2', 4, 'cuadrada', 260, 100);
  crearMesa(terraza.id, 'T-3', 6, 'redonda', 440, 80, 150, 150);
  crearMesa(terraza.id, 'T-4', 2, 'cuadrada', 680, 100, 90, 90);
  crearMesa(terraza.id, 'T-5', 4, 'cuadrada', 80, 300);
  crearMesa(terraza.id, 'T-6', 4, 'cuadrada', 260, 300);
  crearMesa(terraza.id, 'T-7', 8, 'rectangular', 440, 300, 240, 120);

  // Salón interior.
  crearMesa(salon.id, 'S-1', 4, 'cuadrada', 100, 120);
  crearMesa(salon.id, 'S-2', 4, 'cuadrada', 280, 120);
  crearMesa(salon.id, 'S-3', 6, 'redonda', 460, 100, 150, 150);
  crearMesa(salon.id, 'S-4', 4, 'cuadrada', 100, 320);
  crearMesa(salon.id, 'S-5', 4, 'cuadrada', 280, 320);

  // Barra del salón: lugares individuales.
  for (let i = 1; i <= 4; i++) {
    crearMesa(salon.id, `B-${i}`, 1, 'barra', 700 + (i - 1) * 80, 140, 70, 70);
  }

  // Palapa para grupos y eventos.
  crearMesa(palapa.id, 'P-1', 10, 'rectangular', 120, 140, 300, 130);
  crearMesa(palapa.id, 'P-2', 10, 'rectangular', 120, 340, 300, 130);
  crearMesa(palapa.id, 'P-3', 6, 'redonda', 520, 200, 160, 160);

  // Referencias visuales para que el mesero se ubique en el plano.
  const elemento = (
    zonaId: number,
    tipo: 'muro' | 'barra' | 'cocina' | 'bano' | 'planta' | 'texto',
    etiqueta: string,
    x: number,
    y: number,
    ancho: number,
    alto: number,
  ) => tx.insert(elementosPlano).values({ layoutId: layout.id, zonaId, tipo, etiqueta, x, y, ancho, alto }).run();

  elemento(terraza.id, 'texto', 'Vista al mar', 80, 20, 240, 50);
  elemento(salon.id, 'barra', 'Barra', 680, 60, 400, 60);
  elemento(salon.id, 'cocina', 'Cocina', 900, 400, 240, 200);
  elemento(salon.id, 'bano', 'Baños', 900, 640, 240, 90);
  elemento(palapa.id, 'planta', 'Palmera', 700, 460, 100, 100);
});

console.log('Comedor de ejemplo creado: 3 zonas, 19 mesas y 5 elementos.');
