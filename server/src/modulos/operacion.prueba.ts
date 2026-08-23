import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-operacion-'));
process.env.DB_RUTA = path.join(carpeta, 'prueba.sqlite');

let auth: typeof import('./auth/auth.servicio.js');
let menu: typeof import('./menu/menu.servicio.js');
let ordenes: typeof import('./ordenes/ordenes.servicio.js');
let cuentas: typeof import('./cuentas/cuentas.servicio.js');
let caja: typeof import('./caja/caja.servicio.js');
let salon: typeof import('./salon/salon.servicio.js');

let admin: { id: number };
let mesero: { id: number };
let categoriaId: number;
let layoutId: number;
let siguienteMesa = 0;

/** Cada prueba trabaja en su propia mesa: así una no arrastra a la siguiente. */
function nuevaMesa(): number {
  siguienteMesa++;
  const zona = salon.obtenerPlano(layoutId).zonas[0]!;
  return salon.crearMesa(
    { zonaId: zona.id, nombre: `M-${siguienteMesa}`, capacidad: 4, forma: 'cuadrada', x: 0, y: 0, ancho: 100, alto: 100, rotacion: 0 },
    layoutId,
  ).id;
}

before(async () => {
  const { migrar } = await import('../db/migrar.js');
  migrar();
  auth = await import('./auth/auth.servicio.js');
  menu = await import('./menu/menu.servicio.js');
  ordenes = await import('./ordenes/ordenes.servicio.js');
  cuentas = await import('./cuentas/cuentas.servicio.js');
  caja = await import('./caja/caja.servicio.js');
  salon = await import('./salon/salon.servicio.js');

  const { db } = await import('../db/cliente.js');
  const { layouts } = await import('../db/esquema.js');
  const layout = db.insert(layouts).values({ nombre: 'Normal', activo: true }).returning().get();
  layoutId = layout.id;

  admin = auth.crearUsuario({ nombre: 'Dueña', rol: 'admin', pin: '1111' });
  mesero = auth.crearUsuario({ nombre: 'Luis', rol: 'mesero', pin: '2222' });

  salon.crearZona({ nombre: 'Terraza' });
  categoriaId = menu.crearCategoria({ nombre: 'Cocteles' }).id;
});

after(() => fs.rmSync(carpeta, { recursive: true, force: true }));

/* ── Menú flexible ───────────────────────────────────────────────────── */

test('un producto simple nace con una sola variante de precio', () => {
  const p = menu.crearProducto({
    categoriaId, nombre: 'Guacamole', descripcion: '', estacion: 'cocina',
    tipoVenta: 'simple', precioCentavos: 9500, variantes: [], gruposIds: [],
  });
  assert.equal(p.variantes.length, 1);
  assert.equal(p.variantes[0]?.precioCentavos, 9500);
});

test('un producto con tamaños exige al menos una variante', () => {
  assert.throws(
    () => menu.crearProducto({
      categoriaId, nombre: 'Sin tamaños', descripcion: '', estacion: 'cocina',
      tipoVenta: 'variantes', precioCentavos: 0, variantes: [], gruposIds: [],
    }),
    /al menos una variante/,
  );
});

test('cambiar de estilo de venta conserva el precio y no duplica variantes', () => {
  const p = menu.crearProducto({
    categoriaId, nombre: 'Ceviche', descripcion: '', estacion: 'cocina', tipoVenta: 'variantes',
    precioCentavos: 0, gruposIds: [],
    variantes: [{ nombre: 'Orden', precioCentavos: 18500 }, { nombre: 'Media', precioCentavos: 11000 }],
  });
  const simple = menu.actualizarProducto(p.id, { tipoVenta: 'simple' });
  assert.equal(simple.variantes.filter((v) => v.activa).length, 1);
  assert.equal(simple.variantes.find((v) => v.activa)?.precioCentavos, 18500);
});

test('marcar agotado saca el producto del menú vendible', () => {
  const p = menu.crearProducto({
    categoriaId, nombre: 'Pulpo', descripcion: '', estacion: 'cocina',
    tipoVenta: 'simple', precioCentavos: 25000, variantes: [], gruposIds: [],
  });
  menu.marcarDisponibilidad(p.id, false);
  const enMenu = menu.obtenerMenu({ soloVendibles: true }).flatMap((c) => c.productos).find((x) => x.id === p.id);
  assert.equal(enMenu?.disponibleHoy, false);
  menu.marcarDisponibilidad(p.id, true);
});

/* ── Flujo de servicio completo ──────────────────────────────────────── */

test('flujo completo: abrir mesa, capturar, enviar, cobrar y cerrar', () => {
  caja.abrirTurno(admin.id, 100_000);

  const coctel = menu.crearProducto({
    categoriaId, nombre: 'Coctel de camarón', descripcion: '', estacion: 'cocina', tipoVenta: 'variantes',
    precioCentavos: 0, gruposIds: [],
    variantes: [{ nombre: 'Grande', precioCentavos: 22500 }],
  });
  const cerveza = menu.crearProducto({
    categoriaId, nombre: 'Cerveza', descripcion: '', estacion: 'barra',
    tipoVenta: 'simple', precioCentavos: 4500, variantes: [], gruposIds: [],
  });

  const mesaId = nuevaMesa();
  const orden = ordenes.abrirOrden({ mesaId, comensales: 2 }, mesero.id);
  assert.equal(salon.obtenerMesa(mesaId, layoutId).estado, 'ocupada');

  ordenes.agregarLineas(orden.id, {
    lineas: [
      { varianteId: coctel.variantes[0]!.id, cantidadMilesimas: 2000, nota: '', modificadoresIds: [] },
      { varianteId: cerveza.variantes[0]!.id, cantidadMilesimas: 3000, nota: '', modificadoresIds: [] },
    ],
  });

  // Se separa en dos comandas: cocina y barra.
  const envio = ordenes.enviarComanda(orden.id, 'clave-de-prueba-1');
  assert.equal(envio.comandas.length, 2);
  assert.deepEqual(envio.comandas.map((c) => c.estacion).sort(), ['barra', 'cocina']);

  // Reenviar con la misma clave no duplica la comanda (red intermitente).
  const repetido = ordenes.enviarComanda(orden.id, 'clave-de-prueba-1');
  assert.equal(repetido.repetida, true);

  const [cuenta] = cuentas.cuentasDeOrden(orden.id);
  // 2 × 225.00 + 3 × 45.00 = 585.00
  assert.equal(cuenta?.subtotalCentavos, 58_500);
  assert.equal(cuenta?.totalCentavos, 58_500); // precios con impuesto incluido

  const resultado = cuentas.cobrar(cuenta!.id, {
    pagos: [{ metodo: 'efectivo', montoCentavos: 58_500, referencia: '', recibidoCentavos: 60_000 }],
  }, admin.id);

  assert.equal(resultado.repetido, false);
  assert.equal(resultado.ordenCerrada, true);
  assert.equal(salon.obtenerMesa(mesaId, layoutId).estado, 'por_limpiar');
});

test('no se puede cobrar sin turno de caja abierto', () => {
  const turno = caja.turnoAbierto()!;
  caja.cerrarTurno(turno.id, 0, admin.id);

  const orden = ordenes.abrirOrden({ mesaId: nuevaMesa(), comensales: 1 }, mesero.id);
  const producto = menu.obtenerMenu().flatMap((c) => c.productos).find((p) => p.nombre === 'Guacamole')!;
  ordenes.agregarLineas(orden.id, {
    lineas: [{ varianteId: producto.variantes[0]!.id, cantidadMilesimas: 1000, nota: '', modificadoresIds: [] }],
  });
  const [cuenta] = cuentas.cuentasDeOrden(orden.id);

  assert.throws(
    () => cuentas.cobrar(cuenta!.id, { pagos: [{ metodo: 'efectivo', montoCentavos: 9500, referencia: '' }] }, admin.id),
    /turno de caja/,
  );

  caja.abrirTurno(admin.id, 0);
  cuentas.cobrar(cuenta!.id, { pagos: [{ metodo: 'efectivo', montoCentavos: 9500, referencia: '' }] }, admin.id);
});

test('dividir en partes iguales no pierde ni un centavo', () => {
  const orden = ordenes.abrirOrden({ mesaId: nuevaMesa(), comensales: 3 }, mesero.id);
  const producto = menu.crearProducto({
    categoriaId, nombre: 'Botana impar', descripcion: '', estacion: 'cocina',
    tipoVenta: 'simple', precioCentavos: 10_001, variantes: [], gruposIds: [],
  });
  ordenes.agregarLineas(orden.id, {
    lineas: [{ varianteId: producto.variantes[0]!.id, cantidadMilesimas: 1000, nota: '', modificadoresIds: [] }],
  });

  const divididas = cuentas.dividirEnPartesIguales(orden.id, 3);
  assert.equal(divididas.length, 3);
  const suma = divididas.reduce((a, c) => a + c.subtotalCentavos, 0);
  assert.equal(suma, 10_001, 'la suma de las partes debe ser exactamente el total');
});

test('cancelar una línea enviada exige PIN de autorización y queda en bitácora', () => {
  const orden = ordenes.abrirOrden({ mesaId: nuevaMesa(), comensales: 1 }, mesero.id);
  const producto = menu.obtenerMenu().flatMap((c) => c.productos).find((p) => p.nombre === 'Guacamole')!;
  const conLinea = ordenes.agregarLineas(orden.id, {
    lineas: [{ varianteId: producto.variantes[0]!.id, cantidadMilesimas: 1000, nota: '', modificadoresIds: [] }],
  });
  const lineaId = conLinea.lineas[0]!.id;
  ordenes.enviarComanda(orden.id);

  assert.throws(() => ordenes.actualizarLinea(lineaId, { cantidadMilesimas: 2000 }), /ya se envió/);
  assert.throws(
    () => ordenes.cancelarLinea(lineaId, { motivo: 'se equivocó', pinAutorizacion: '2222', esCortesia: false }, mesero.id),
    /autorización inválido/,
  );

  ordenes.cancelarLinea(lineaId, { motivo: 'cliente cambió de opinión', pinAutorizacion: '1111', esCortesia: false }, mesero.id);
  const [cuenta] = cuentas.cuentasDeOrden(orden.id);
  assert.equal(cuenta?.subtotalCentavos, 0, 'una línea cancelada no se cobra');

  const registro = auth.listarBitacora().find((b) => b.accion === 'linea_cancelada');
  assert.ok(registro, 'la cancelación debe quedar registrada');
  assert.match(registro.detalle, /autorizó Dueña/);
});

test('el corte de caja cuadra con lo cobrado y detecta la diferencia', () => {
  const turno = caja.turnoAbierto()!;
  const resumen = caja.resumenTurno(turno.id);
  const esperado = resumen.esperadoEfectivoCentavos;

  caja.registrarMovimiento({ tipo: 'retiro', montoCentavos: 5_000, concepto: 'Compra de hielo', usuarioId: admin.id });

  const conRetiro = caja.resumenTurno(turno.id);
  assert.equal(conRetiro.esperadoEfectivoCentavos, esperado - 5_000);
});

/* ── Integridad de mesas y cuentas (hallazgos de la prueba de usabilidad) ── */

test('una cuenta vacía no deja la mesa colgada: se elimina al cobrar la última con consumo', () => {
  const mesaId = nuevaMesa();
  const orden = ordenes.abrirOrden({ mesaId, comensales: 2 }, mesero.id);
  const producto = menu.obtenerMenu().flatMap((c) => c.productos).find((p) => p.nombre === 'Guacamole')!;
  ordenes.agregarLineas(orden.id, {
    lineas: [{ varianteId: producto.variantes[0]!.id, cantidadMilesimas: 1000, nota: '', modificadoresIds: [] }],
  });

  // El mesero crea una segunda cuenta y nunca le asigna nada.
  cuentas.crearCuenta(orden.id, 'Cuenta 2');
  const abiertas = cuentas.cuentasDeOrden(orden.id);
  assert.equal(abiertas.length, 2);

  const conConsumo = abiertas.find((c) => c.lineas.length > 0)!;
  const resultado = cuentas.cobrar(
    conConsumo.id,
    { pagos: [{ metodo: 'efectivo', montoCentavos: conConsumo.totalCentavos, referencia: '' }] },
    admin.id,
  );

  assert.equal(resultado.ordenCerrada, true, 'la orden debe cerrarse pese a la cuenta vacía');
  assert.equal(salon.obtenerMesa(mesaId, layoutId).estado, 'por_limpiar');
  assert.equal(cuentas.cuentasDeOrden(orden.id).length, 1, 'la cuenta vacía se descarta');
});

test('una mesa abierta por error se cancela y queda libre', () => {
  const mesaId = nuevaMesa();
  const orden = ordenes.abrirOrden({ mesaId, comensales: 1 }, mesero.id);
  ordenes.cancelarOrdenVacia(orden.id, mesero.id);

  assert.equal(salon.obtenerMesa(mesaId, layoutId).estado, 'libre');
  assert.equal(ordenes.ordenAbiertaDeMesa(mesaId), undefined, 'no debe quedar orden abierta');
  // Y la mesa vuelve a servir: se puede abrir de nuevo.
  ordenes.abrirOrden({ mesaId, comensales: 3 }, mesero.id);
});

test('una mesa con consumo NO se puede cancelar como si estuviera vacía', () => {
  const mesaId = nuevaMesa();
  const orden = ordenes.abrirOrden({ mesaId, comensales: 2 }, mesero.id);
  const producto = menu.obtenerMenu().flatMap((c) => c.productos).find((p) => p.nombre === 'Guacamole')!;
  ordenes.agregarLineas(orden.id, {
    lineas: [{ varianteId: producto.variantes[0]!.id, cantidadMilesimas: 1000, nota: '', modificadoresIds: [] }],
  });

  assert.throws(() => ordenes.cancelarOrdenVacia(orden.id, mesero.id), /ya tiene consumo/);
});

test('repartir un platillo compartido divide el importe sin perder centavos', () => {
  const mesaId = nuevaMesa();
  const orden = ordenes.abrirOrden({ mesaId, comensales: 3 }, mesero.id);
  const botana = menu.crearProducto({
    categoriaId, nombre: 'Botana para tres', descripcion: '', estacion: 'cocina',
    tipoVenta: 'simple', precioCentavos: 10_000, variantes: [], gruposIds: [],
  });
  const conLinea = ordenes.agregarLineas(orden.id, {
    lineas: [{ varianteId: botana.variantes[0]!.id, cantidadMilesimas: 1000, nota: '', modificadoresIds: [] }],
  });
  const lineaId = conLinea.lineas[0]!.id;

  const c2 = cuentas.crearCuenta(orden.id, 'Cuenta 2');
  const c3 = cuentas.crearCuenta(orden.id, 'Cuenta 3');
  const c1 = cuentas.cuentasDeOrden(orden.id)[0]!;

  const repartidas = cuentas.repartirLinea({ lineaId, cuentaIds: [c1.id, c2.id, c3.id] });
  const suma = repartidas.reduce((a, c) => a + c.subtotalCentavos, 0);

  assert.equal(suma, 10_000, 'las tres partes deben sumar exactamente el platillo');
  assert.deepEqual(repartidas.map((c) => c.subtotalCentavos).sort(), [3333, 3333, 3334]);
});

test('el tablero del mesero muestra lo que reclama atención', () => {
  const mesaId = nuevaMesa();
  const orden = ordenes.abrirOrden({ mesaId, comensales: 2 }, mesero.id);
  const producto = menu.obtenerMenu().flatMap((c) => c.productos).find((p) => p.nombre === 'Guacamole')!;
  ordenes.agregarLineas(orden.id, {
    lineas: [{ varianteId: producto.variantes[0]!.id, cantidadMilesimas: 2000, nota: '', modificadoresIds: [] }],
  });

  const enTablero = ordenes.tablero().find((m) => m.id === mesaId);
  assert.equal(enTablero?.orden?.sinEnviar, 1, 'debe avisar que hay algo sin enviar');
  assert.equal(enTablero?.orden?.totalCentavos, 19_000);
  assert.equal(enTablero?.orden?.mesero, 'Luis');
  assert.equal(enTablero?.orden?.vacia, false);

  ordenes.enviarComanda(orden.id);
  assert.equal(ordenes.tablero().find((m) => m.id === mesaId)?.orden?.sinEnviar, 0);
});

/* ── Hallazgos de la prueba de estrés del día festivo ─────────────────── */

test('cancelar una mesa abierta por error no deja una cuenta huérfana bloqueando la caja', () => {
  const mesaId = nuevaMesa();
  const orden = ordenes.abrirOrden({ mesaId, comensales: 2 }, mesero.id);
  ordenes.cancelarOrdenVacia(orden.id, mesero.id);

  // Antes de la corrección, esta cuenta seguía "abierta" con total $0.00 para
  // siempre, atada a una orden cancelada, y ninguna pantalla podía encontrarla.
  const huerfana = cuentas.cuentasDeOrden(orden.id);
  assert.equal(huerfana.length, 0, 'la cuenta de la orden cancelada debe desaparecer, no quedar abierta');
});

test('el corte de caja no se bloquea por mesas que se cerraron vacías', () => {
  // Tres meseros abren mesas por error y las cierran, como en un servicio real.
  // Antes de la corrección, cada una dejaba una cuenta huérfana "abierta" con
  // $0.00 para siempre, y el corte de caja fallaba con
  // "Todavía hay N cuenta(s) sin cobrar" sin que existiera ninguna pantalla
  // desde la cual un administrador pudiera encontrarlas ni repararlas.
  const ordenesCanceladas = [];
  for (let i = 0; i < 3; i++) {
    const orden = ordenes.abrirOrden({ mesaId: nuevaMesa(), comensales: 2 }, mesero.id);
    ordenes.cancelarOrdenVacia(orden.id, mesero.id);
    ordenesCanceladas.push(orden.id);
  }

  for (const ordenId of ordenesCanceladas) {
    assert.equal(cuentas.cuentasDeOrden(ordenId).length, 0, 'no debe quedar ninguna cuenta abierta atada a la orden cancelada');
  }
});

test('mover un platillo a una cuenta de OTRA mesa se rechaza (antes creaba una asociación cruzada)', () => {
  const mesaA = nuevaMesa();
  const mesaB = nuevaMesa();
  const ordenA = ordenes.abrirOrden({ mesaId: mesaA, comensales: 2 }, mesero.id);
  const ordenB = ordenes.abrirOrden({ mesaId: mesaB, comensales: 2 }, mesero.id);
  const producto = menu.obtenerMenu().flatMap((c) => c.productos).find((p) => p.nombre === 'Guacamole')!;

  const conLinea = ordenes.agregarLineas(ordenA.id, {
    lineas: [{ varianteId: producto.variantes[0]!.id, cantidadMilesimas: 1000, nota: '', modificadoresIds: [] }],
  });
  const lineaDeA = conLinea.lineas[0]!.id;
  const [cuentaDeB] = cuentas.cuentasDeOrden(ordenB.id);

  assert.throws(
    () => cuentas.asignarLinea({ cuentaId: cuentaDeB!.id, lineaId: lineaDeA, proporcionMilesimas: 1000, exclusiva: true }),
    /no pertenece a esta mesa/,
  );
});

test('repartir un platillo entre cuentas de OTRA mesa también se rechaza', () => {
  const mesaA = nuevaMesa();
  const mesaB = nuevaMesa();
  const ordenA = ordenes.abrirOrden({ mesaId: mesaA, comensales: 2 }, mesero.id);
  const ordenB = ordenes.abrirOrden({ mesaId: mesaB, comensales: 2 }, mesero.id);
  const producto = menu.obtenerMenu().flatMap((c) => c.productos).find((p) => p.nombre === 'Guacamole')!;

  const conLinea = ordenes.agregarLineas(ordenA.id, {
    lineas: [{ varianteId: producto.variantes[0]!.id, cantidadMilesimas: 1000, nota: '', modificadoresIds: [] }],
  });
  const lineaDeA = conLinea.lineas[0]!.id;
  const [cuentaDeB] = cuentas.cuentasDeOrden(ordenB.id);

  assert.throws(
    () => cuentas.repartirLinea({ lineaId: lineaDeA, cuentaIds: [cuentaDeB!.id] }),
    /no pertenece a esta mesa/,
  );
});

test('la pantalla de cocina no acumula comandas de mesas ya cobradas o canceladas', () => {
  const mesaId = nuevaMesa();
  const orden = ordenes.abrirOrden({ mesaId, comensales: 2 }, mesero.id);
  const producto = menu.obtenerMenu().flatMap((c) => c.productos).find((p) => p.nombre === 'Guacamole')!;
  ordenes.agregarLineas(orden.id, {
    lineas: [{ varianteId: producto.variantes[0]!.id, cantidadMilesimas: 1000, nota: '', modificadoresIds: [] }],
  });
  ordenes.enviarComanda(orden.id);

  const antesDeCobrar = ordenes.comandasPendientes().length;
  assert.ok(antesDeCobrar > 0, 'la comanda debe verse mientras la mesa sigue en servicio');

  const [cuenta] = cuentas.cuentasDeOrden(orden.id);
  cuentas.cobrar(cuenta!.id, { pagos: [{ metodo: 'efectivo', montoCentavos: cuenta!.totalCentavos, referencia: '' }] }, admin.id);

  // Nadie va a tocar "listo" en una comanda de una mesa que ya se cobró y se fue.
  const trasCobrar = ordenes.comandasPendientes();
  assert.equal(trasCobrar.length, antesDeCobrar - 1, 'la comanda de la mesa cobrada debe desaparecer del tablero de cocina');
});
