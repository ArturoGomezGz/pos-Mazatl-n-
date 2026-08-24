import path from 'node:path';
import { db } from './cliente.js';
import {
  categorias,
  elementosPlano,
  gruposModificadores,
  layouts,
  mesaPosiciones,
  mesas,
  modificadores,
  productoGrupos,
  productos,
  usuarios,
  variantes,
  zonas,
} from './esquema.js';
import { hashearPin } from '../modulos/auth/auth.servicio.js';
import { migrar } from './migrar.js';

/** Datos de arranque: un comedor de ejemplo parecido al de Mariscos Mazatlán,
 *  para poder probar el editor y la vista de salón desde el primer minuto.
 *  Idempotente: cada bloque revisa si ya hay datos antes de insertar, así que
 *  se puede llamar en cada arranque del servidor sin duplicar nada. */
export function sembrar(): void {
  migrar();

  const yaHayZonas = db.select().from(zonas).all().length > 0;

  if (!yaHayZonas) db.transaction((tx) => {
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

  if (!yaHayZonas) console.log('Comedor de ejemplo creado: 3 zonas, 19 mesas y 5 elementos.');

  /* ── Usuarios ────────────────────────────────────────────────────────── */

  if (db.select().from(usuarios).all().length === 0) {
    const equipo: { nombre: string; rol: 'admin' | 'cajero' | 'mesero' | 'cocina'; pin: string }[] = [
      { nombre: 'Doña Rosa (dueña)', rol: 'admin', pin: '1234' },
      { nombre: 'Miguel (caja)', rol: 'cajero', pin: '2222' },
      { nombre: 'Luis', rol: 'mesero', pin: '3333' },
      { nombre: 'Karla', rol: 'mesero', pin: '4444' },
      { nombre: 'Cocina', rol: 'cocina', pin: '5555' },
    ];
    for (const u of equipo) {
      db.insert(usuarios).values({ nombre: u.nombre, rol: u.rol, pinHash: hashearPin(u.pin) }).run();
    }
    console.log('Equipo de ejemplo creado. PIN del administrador: 1234');
  }

  /* ── Menú ────────────────────────────────────────────────────────────── */

  if (db.select().from(categorias).all().length === 0) {
    db.transaction((tx) => {
      const grupo = (nombre: string, min: number, max: number, opciones: [string, number][]) => {
        const g = tx.insert(gruposModificadores).values({ nombre, minSelecciones: min, maxSelecciones: max }).returning().get();
        opciones.forEach(([n, precio], i) => {
          tx.insert(modificadores).values({ grupoId: g.id, nombre: n, precioExtraCentavos: precio, orden: i }).run();
        });
        return g;
      };

      const termino = grupo('Término', 1, 1, [['Bien cocido', 0], ['Término medio', 0], ['Jugoso', 0]]);
      const sinIngrediente = grupo('Sin ingrediente', 0, 4, [
        ['Sin cebolla', 0], ['Sin cilantro', 0], ['Sin picante', 0], ['Sin limón', 0],
      ]);
      const extras = grupo('Extras', 0, 3, [
        ['Extra aguacate', 3500], ['Extra queso', 2500], ['Tortillas extra', 1500], ['Salsa aparte', 0],
      ]);

      const categoria = (nombre: string, color: string, orden: number) =>
        tx.insert(categorias).values({ nombre, color, orden }).returning().get();

      type Estilo = 'simple' | 'variantes' | 'peso' | 'abierto';
      const producto = (
        categoriaId: number,
        nombre: string,
        estilo: Estilo,
        precios: [string, number][],
        estacion: 'cocina' | 'barra' = 'cocina',
        grupos: number[] = [],
        descripcion = '',
      ) => {
        const p = tx
          .insert(productos)
          .values({
            categoriaId,
            nombre,
            descripcion,
            estacion,
            tipoVenta: estilo,
            unidad: estilo === 'peso' ? 'kg' : 'pieza',
          })
          .returning()
          .get();
        precios.forEach(([n, precio], i) => {
          tx.insert(variantes).values({ productoId: p.id, nombre: n, precioCentavos: precio, orden: i }).run();
        });
        grupos.forEach((grupoId, i) => tx.insert(productoGrupos).values({ productoId: p.id, grupoId, orden: i }).run());
        return p;
      };

      // Cada categoría muestra un estilo de venta distinto: es el punto del diseño.
      const botanas = categoria('Botanas', '#e4572e', 0);
      producto(botanas.id, 'Guacamole', 'simple', [['Único', 9500]], 'cocina', [extras.id]);
      producto(botanas.id, 'Ceviche de pescado', 'variantes', [['Orden', 18500], ['Media orden', 11000]], 'cocina', [sinIngrediente.id]);
      producto(botanas.id, 'Tostada de atún', 'simple', [['Única', 7500]], 'cocina', [sinIngrediente.id]);

      const cocteles = categoria('Cocteles', '#13618c', 1);
      producto(cocteles.id, 'Coctel de camarón', 'variantes', [['Chico', 14500], ['Mediano', 18000], ['Grande', 22500]], 'cocina', [sinIngrediente.id]);
      producto(cocteles.id, 'Campechana', 'variantes', [['Chica', 16500], ['Grande', 24000]], 'cocina', [sinIngrediente.id]);
      producto(cocteles.id, 'Aguachile', 'variantes', [['Orden', 19500], ['Media orden', 12000]], 'cocina', [sinIngrediente.id]);

      const fuertes = categoria('Platos fuertes', '#2e9e5b', 2);
      producto(fuertes.id, 'Filete empanizado', 'simple', [['Único', 21500]], 'cocina', [termino.id, extras.id]);
      producto(fuertes.id, 'Camarones al mojo de ajo', 'simple', [['Único', 26500]], 'cocina', [sinIngrediente.id, extras.id]);
      producto(fuertes.id, 'Mojarra frita', 'peso', [['Por kilo', 32000]], 'cocina', [], 'Se cobra por peso, según la pieza');
      producto(fuertes.id, 'Pescado del día', 'abierto', [['Precio del día', 0]], 'cocina', [termino.id], 'El precio depende de la pesca');
      producto(fuertes.id, 'Mariscada para compartir', 'abierto', [['Precio del día', 0]], 'cocina', [], 'Se arma con lo que haya fresco');

      const bebidas = categoria('Bebidas', '#f0a202', 3);
      producto(bebidas.id, 'Cerveza clara', 'simple', [['Única', 4500]], 'barra');
      producto(bebidas.id, 'Michelada', 'variantes', [['Chica', 6500], ['Grande', 8500]], 'barra');
      producto(bebidas.id, 'Agua fresca', 'variantes', [['Vaso', 3500], ['Jarra', 9000]], 'barra');
      producto(bebidas.id, 'Refresco', 'simple', [['Único', 3500]], 'barra');
    });
    console.log('Menú de ejemplo creado con los cuatro estilos de venta.');
  }
}

// Permite ejecutarlo como script: npm run db:seed
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  sembrar();
}
