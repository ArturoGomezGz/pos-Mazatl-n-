import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

// La configuración se lee al importar, así que el entorno se prepara antes
// de cargar los módulos que tocan la base de datos.
const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-prueba-'));
process.env.DB_RUTA = path.join(carpeta, 'prueba.sqlite');

type Salon = typeof import('./salon.servicio.js');
let salon: Salon;
let layoutId: number;

before(async () => {
  const { migrar } = await import('../../db/migrar.js');
  migrar();
  salon = await import('./salon.servicio.js');
  const { db } = await import('../../db/cliente.js');
  const { layouts } = await import('../../db/esquema.js');
  layoutId = db.insert(layouts).values({ nombre: 'Normal', activo: true }).returning().get().id;
});

after(() => fs.rmSync(carpeta, { recursive: true, force: true }));

test('crea una zona y una mesa colocada en el plano', () => {
  const zona = salon.crearZona({ nombre: 'Terraza' });
  const mesa = salon.crearMesa(
    { zonaId: zona.id, nombre: 'T-1', capacidad: 4, forma: 'cuadrada', x: 40, y: 60, ancho: 110, alto: 110, rotacion: 0 },
    layoutId,
  );

  const plano = salon.obtenerPlano(layoutId);
  const enPlano = plano.zonas[0]?.mesas.find((m) => m.id === mesa.id);
  assert.equal(enPlano?.nombre, 'T-1');
  assert.equal(enPlano?.x, 40);
  assert.equal(enPlano?.colocada, true);
});

test('el guardado por lote persiste las posiciones', () => {
  const plano = salon.obtenerPlano(layoutId);
  const mesa = plano.zonas[0]!.mesas[0]!;

  salon.guardarPosiciones(layoutId, {
    mesas: [{ id: mesa.id, x: 200, y: 300, ancho: 120, alto: 120, rotacion: 90 }],
    elementos: [],
    barras: [],
  });

  const guardada = salon.obtenerMesa(mesa.id, layoutId);
  assert.deepEqual(
    { x: guardada.x, y: guardada.y, ancho: guardada.ancho, rotacion: guardada.rotacion },
    { x: 200, y: 300, ancho: 120, rotacion: 90 },
  );
});

test('no se puede borrar una mesa con historial de ventas (aunque la orden ya esté cobrada)', async () => {
  const { db } = await import('../../db/cliente.js');
  const { ordenes, usuarios } = await import('../../db/esquema.js');

  const zona = salon.crearZona({ nombre: 'Con historial' });
  const mesa = salon.crearMesa({ zonaId: zona.id, nombre: 'H-1', capacidad: 4, forma: 'cuadrada', x: 0, y: 0, ancho: 100, alto: 100, rotacion: 0 }, layoutId);
  const mesero = db.insert(usuarios).values({ nombre: 'Mesero historial', rol: 'mesero', pinHash: 'x' }).returning().get();
  db.insert(ordenes).values({ folio: 1, mesaId: mesa.id, meseroId: mesero.id, estado: 'cobrada' }).run();

  assert.throws(() => salon.eliminarMesa(mesa.id), /historial de ventas/);
});

test('copiar una distribución conserva las posiciones del original', () => {
  const copia = salon.crearLayout({ nombre: 'Temporada alta', copiarDeId: layoutId });
  const original = salon.obtenerPlano(layoutId).zonas[0]!.mesas[0]!;
  const copiada = salon.obtenerPlano(copia.id).zonas[0]!.mesas[0]!;

  assert.equal(copiada.x, original.x);
  assert.equal(copiada.y, original.y);
});

test('mover una mesa en una distribución no afecta a la otra', () => {
  const [primera, segunda] = salon.listarLayouts();
  const mesaId = salon.obtenerPlano(primera!.id).zonas[0]!.mesas[0]!.id;

  salon.guardarPosiciones(segunda!.id, {
    mesas: [{ id: mesaId, x: 800, y: 40, ancho: 120, alto: 120, rotacion: 0 }],
    elementos: [],
    barras: [],
  });

  assert.equal(salon.obtenerMesa(mesaId, primera!.id).x, 200);
  assert.equal(salon.obtenerMesa(mesaId, segunda!.id).x, 800);
});

test('no se puede eliminar una zona que todavía tiene mesas', () => {
  const zona = salon.obtenerPlano(layoutId).zonas[0]!;
  assert.throws(() => salon.eliminarZona(zona.id), /todavía tiene mesas/);
});

test('siempre queda al menos una distribución', () => {
  const [, segunda] = salon.listarLayouts();
  salon.eliminarLayout(segunda!.id);
  const restante = salon.listarLayouts();
  assert.equal(restante.length, 1);
  assert.throws(() => salon.eliminarLayout(restante[0]!.id), /al menos una distribución/);
});

test('crear una barra genera un lugar independiente por cada uno, numerados B-n-lugar', () => {
  const zona = salon.crearZona({ nombre: 'Barra zona' });
  const barra = salon.crearBarra({ zonaId: zona.id, lugares: 3, x: 0, y: 0, ancho: 300, alto: 60, rotacion: 0 }, layoutId);

  const plano = salon.obtenerPlano(layoutId);
  const zonaPlano = plano.zonas.find((z) => z.id === zona.id)!;
  const lugares = zonaPlano.mesas.filter((m) => m.barraId === barra.id).sort((a, b) => (a.numeroLugar ?? 0) - (b.numeroLugar ?? 0));

  assert.equal(lugares.length, 3);
  assert.deepEqual(lugares.map((l) => l.nombre), [`B-${barra.numero}-1`, `B-${barra.numero}-2`, `B-${barra.numero}-3`]);
  // Los lugares cubren exactamente el ancho de la barra, sin huecos.
  assert.equal(lugares[0]!.x, 0);
  assert.equal(lugares[2]!.x + lugares[2]!.ancho, 300);
  assert.equal(lugares.reduce((a, l) => a + l.ancho, 0), 300);
});

test('no se puede reducir una barra si un lugar a quitar tiene una cuenta abierta', async () => {
  const { db } = await import('../../db/cliente.js');
  const { ordenes, usuarios } = await import('../../db/esquema.js');

  const zona = salon.crearZona({ nombre: 'Barra ocupada' });
  const barra = salon.crearBarra({ zonaId: zona.id, lugares: 2, x: 0, y: 0, ancho: 140, alto: 60, rotacion: 0 }, layoutId);
  const lugar2 = salon.obtenerPlano(layoutId).zonas.find((z) => z.id === zona.id)!.mesas.find((m) => m.barraId === barra.id && m.numeroLugar === 2)!;

  const mesero = db.insert(usuarios).values({ nombre: 'Mesero prueba', rol: 'mesero', pinHash: 'x' }).returning().get();
  db.insert(ordenes).values({ folio: 2, mesaId: lugar2.id, meseroId: mesero.id, estado: 'abierta' }).run();

  assert.throws(() => salon.actualizarBarra(barra.id, { lugares: 1 }, layoutId), /cuenta abierta/);
});

test('al eliminar la distribución activa se activa otra', () => {
  const otra = salon.crearLayout({ nombre: 'Evento' });
  salon.actualizarLayout(otra.id, { activo: true });
  assert.equal(salon.layoutActivo()?.id, otra.id);

  salon.eliminarLayout(otra.id);
  const activo = salon.layoutActivo();
  assert.ok(activo, 'debe quedar una distribución activa');
  assert.equal(activo.activo, true);
});
