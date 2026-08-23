import { sql } from 'drizzle-orm';
import { sqliteTable, integer, text, primaryKey } from 'drizzle-orm/sqlite-core';

/** Estados posibles de una mesa durante el servicio. */
export const ESTADOS_MESA = ['libre', 'ocupada', 'cuenta_pedida', 'por_limpiar', 'reservada'] as const;
export const FORMAS_MESA = ['cuadrada', 'redonda', 'rectangular', 'barra'] as const;
export const TIPOS_ELEMENTO = ['muro', 'barra', 'cocina', 'bano', 'planta', 'texto'] as const;

export const zonas = sqliteTable('zonas', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nombre: text('nombre').notNull(),
  orden: integer('orden').notNull().default(0),
  activa: integer('activa', { mode: 'boolean' }).notNull().default(true),
  ancho: integer('ancho').notNull().default(1200),
  alto: integer('alto').notNull().default(800),
  creadoEn: text('creado_en').notNull().default(sql`(datetime('now'))`),
});

export const layouts = sqliteTable('layouts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nombre: text('nombre').notNull(),
  activo: integer('activo', { mode: 'boolean' }).notNull().default(false),
  creadoEn: text('creado_en').notNull().default(sql`(datetime('now'))`),
});

export const mesas = sqliteTable('mesas', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  zonaId: integer('zona_id').notNull().references(() => zonas.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
  capacidad: integer('capacidad').notNull().default(4),
  forma: text('forma', { enum: FORMAS_MESA }).notNull().default('cuadrada'),
  activa: integer('activa', { mode: 'boolean' }).notNull().default(true),
  estado: text('estado', { enum: ESTADOS_MESA }).notNull().default('libre'),
  creadoEn: text('creado_en').notNull().default(sql`(datetime('now'))`),
});

export const mesaPosiciones = sqliteTable('mesa_posiciones', {
  layoutId: integer('layout_id').notNull().references(() => layouts.id, { onDelete: 'cascade' }),
  mesaId: integer('mesa_id').notNull().references(() => mesas.id, { onDelete: 'cascade' }),
  x: integer('x').notNull().default(0),
  y: integer('y').notNull().default(0),
  ancho: integer('ancho').notNull().default(100),
  alto: integer('alto').notNull().default(100),
  rotacion: integer('rotacion').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.layoutId, t.mesaId] })]);

export const elementosPlano = sqliteTable('elementos_plano', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  layoutId: integer('layout_id').notNull().references(() => layouts.id, { onDelete: 'cascade' }),
  zonaId: integer('zona_id').notNull().references(() => zonas.id, { onDelete: 'cascade' }),
  tipo: text('tipo', { enum: TIPOS_ELEMENTO }).notNull().default('muro'),
  etiqueta: text('etiqueta').notNull().default(''),
  x: integer('x').notNull().default(0),
  y: integer('y').notNull().default(0),
  ancho: integer('ancho').notNull().default(160),
  alto: integer('alto').notNull().default(60),
  rotacion: integer('rotacion').notNull().default(0),
});

/* ── Operación: usuarios, menú, órdenes, cuentas y caja ─────────────── */

export const ROLES = ['admin', 'cajero', 'mesero', 'cocina'] as const;
export const ESTACIONES = ['cocina', 'barra'] as const;
export const TIPOS_VENTA = ['simple', 'variantes', 'peso', 'abierto'] as const;
export const ESTADOS_LINEA = ['pendiente', 'enviada', 'lista', 'servida', 'cancelada'] as const;
export const METODOS_PAGO = ['efectivo', 'tarjeta', 'transferencia'] as const;
export const TIPOS_MOVIMIENTO = ['entrada', 'retiro', 'gasto', 'propina_pagada'] as const;

const ahora = sql`(datetime('now'))`;

export const usuarios = sqliteTable('usuarios', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nombre: text('nombre').notNull(),
  rol: text('rol', { enum: ROLES }).notNull().default('mesero'),
  pinHash: text('pin_hash').notNull(),
  activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
  creadoEn: text('creado_en').notNull().default(ahora),
});

export const sesiones = sqliteTable('sesiones', {
  token: text('token').primaryKey(),
  usuarioId: integer('usuario_id').notNull().references(() => usuarios.id, { onDelete: 'cascade' }),
  creadaEn: text('creada_en').notNull().default(ahora),
  expiraEn: text('expira_en').notNull(),
});

export const config = sqliteTable('config', {
  clave: text('clave').primaryKey(),
  valor: text('valor').notNull(),
});

export const categorias = sqliteTable('categorias', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nombre: text('nombre').notNull(),
  color: text('color').notNull().default('#13618c'),
  orden: integer('orden').notNull().default(0),
  activa: integer('activa', { mode: 'boolean' }).notNull().default(true),
});

export const productos = sqliteTable('productos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  categoriaId: integer('categoria_id').notNull().references(() => categorias.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
  descripcion: text('descripcion').notNull().default(''),
  estacion: text('estacion', { enum: ESTACIONES }).notNull().default('cocina'),
  tipoVenta: text('tipo_venta', { enum: TIPOS_VENTA }).notNull().default('simple'),
  unidad: text('unidad').notNull().default('pieza'),
  orden: integer('orden').notNull().default(0),
  activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
  disponibleHoy: integer('disponible_hoy', { mode: 'boolean' }).notNull().default(true),
  creadoEn: text('creado_en').notNull().default(ahora),
});

export const variantes = sqliteTable('variantes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productoId: integer('producto_id').notNull().references(() => productos.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull().default('Único'),
  precioCentavos: integer('precio_centavos').notNull().default(0),
  orden: integer('orden').notNull().default(0),
  activa: integer('activa', { mode: 'boolean' }).notNull().default(true),
});

export const gruposModificadores = sqliteTable('grupos_modificadores', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nombre: text('nombre').notNull(),
  minSelecciones: integer('min_selecciones').notNull().default(0),
  maxSelecciones: integer('max_selecciones').notNull().default(1),
  orden: integer('orden').notNull().default(0),
});

export const modificadores = sqliteTable('modificadores', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  grupoId: integer('grupo_id').notNull().references(() => gruposModificadores.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
  precioExtraCentavos: integer('precio_extra_centavos').notNull().default(0),
  orden: integer('orden').notNull().default(0),
  activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
});

export const productoGrupos = sqliteTable('producto_grupos', {
  productoId: integer('producto_id').notNull().references(() => productos.id, { onDelete: 'cascade' }),
  grupoId: integer('grupo_id').notNull().references(() => gruposModificadores.id, { onDelete: 'cascade' }),
  orden: integer('orden').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.productoId, t.grupoId] })]);

export const ordenes = sqliteTable('ordenes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  folio: integer('folio').notNull(),
  mesaId: integer('mesa_id').notNull().references(() => mesas.id),
  meseroId: integer('mesero_id').notNull().references(() => usuarios.id),
  comensales: integer('comensales').notNull().default(1),
  estado: text('estado', { enum: ['abierta', 'cobrada', 'cancelada'] }).notNull().default('abierta'),
  abiertaEn: text('abierta_en').notNull().default(ahora),
  cerradaEn: text('cerrada_en'),
});

export const comandas = sqliteTable('comandas', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ordenId: integer('orden_id').notNull().references(() => ordenes.id, { onDelete: 'cascade' }),
  estacion: text('estacion', { enum: ESTACIONES }).notNull(),
  enviadaEn: text('enviada_en').notNull().default(ahora),
  listaEn: text('lista_en'),
  claveIdempotencia: text('clave_idempotencia'),
});

export const ordenLineas = sqliteTable('orden_lineas', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ordenId: integer('orden_id').notNull().references(() => ordenes.id, { onDelete: 'cascade' }),
  comandaId: integer('comanda_id').references(() => comandas.id),
  productoId: integer('producto_id').references(() => productos.id),
  varianteId: integer('variante_id').references(() => variantes.id),
  productoNombre: text('producto_nombre').notNull(),
  varianteNombre: text('variante_nombre').notNull().default(''),
  estacion: text('estacion', { enum: ESTACIONES }).notNull().default('cocina'),
  unidad: text('unidad').notNull().default('pieza'),
  precioUnitarioCentavos: integer('precio_unitario_centavos').notNull(),
  cantidadMilesimas: integer('cantidad_milesimas').notNull().default(1000),
  nota: text('nota').notNull().default(''),
  estado: text('estado', { enum: ESTADOS_LINEA }).notNull().default('pendiente'),
  esCortesia: integer('es_cortesia', { mode: 'boolean' }).notNull().default(false),
  motivoCancelacion: text('motivo_cancelacion'),
  canceladaPorId: integer('cancelada_por_id').references(() => usuarios.id),
  creadoEn: text('creado_en').notNull().default(ahora),
});

export const lineaModificadores = sqliteTable('linea_modificadores', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  lineaId: integer('linea_id').notNull().references(() => ordenLineas.id, { onDelete: 'cascade' }),
  modificadorId: integer('modificador_id').references(() => modificadores.id),
  nombre: text('nombre').notNull(),
  precioExtraCentavos: integer('precio_extra_centavos').notNull().default(0),
});

export const turnosCaja = sqliteTable('turnos_caja', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  usuarioId: integer('usuario_id').notNull().references(() => usuarios.id),
  abiertoEn: text('abierto_en').notNull().default(ahora),
  fondoInicialCentavos: integer('fondo_inicial_centavos').notNull().default(0),
  cerradoEn: text('cerrado_en'),
  declaradoCentavos: integer('declarado_centavos'),
  esperadoCentavos: integer('esperado_centavos'),
  diferenciaCentavos: integer('diferencia_centavos'),
  estado: text('estado', { enum: ['abierto', 'cerrado'] }).notNull().default('abierto'),
});

export const movimientosCaja = sqliteTable('movimientos_caja', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  turnoId: integer('turno_id').notNull().references(() => turnosCaja.id, { onDelete: 'cascade' }),
  tipo: text('tipo', { enum: TIPOS_MOVIMIENTO }).notNull(),
  montoCentavos: integer('monto_centavos').notNull(),
  concepto: text('concepto').notNull().default(''),
  usuarioId: integer('usuario_id').notNull().references(() => usuarios.id),
  creadoEn: text('creado_en').notNull().default(ahora),
});

export const cuentas = sqliteTable('cuentas', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ordenId: integer('orden_id').notNull().references(() => ordenes.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull().default('Cuenta 1'),
  estado: text('estado', { enum: ['abierta', 'cobrada', 'cancelada'] }).notNull().default('abierta'),
  subtotalCentavos: integer('subtotal_centavos').notNull().default(0),
  descuentoCentavos: integer('descuento_centavos').notNull().default(0),
  motivoDescuento: text('motivo_descuento').notNull().default(''),
  autorizadoPorId: integer('autorizado_por_id').references(() => usuarios.id),
  impuestoCentavos: integer('impuesto_centavos').notNull().default(0),
  propinaCentavos: integer('propina_centavos').notNull().default(0),
  totalCentavos: integer('total_centavos').notNull().default(0),
  turnoId: integer('turno_id').references(() => turnosCaja.id),
  cerradaEn: text('cerrada_en'),
  creadoEn: text('creado_en').notNull().default(ahora),
});

export const cuentaLineas = sqliteTable('cuenta_lineas', {
  cuentaId: integer('cuenta_id').notNull().references(() => cuentas.id, { onDelete: 'cascade' }),
  lineaId: integer('linea_id').notNull().references(() => ordenLineas.id, { onDelete: 'cascade' }),
  proporcionMilesimas: integer('proporcion_milesimas').notNull().default(1000),
}, (t) => [primaryKey({ columns: [t.cuentaId, t.lineaId] })]);

export const pagos = sqliteTable('pagos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cuentaId: integer('cuenta_id').notNull().references(() => cuentas.id, { onDelete: 'cascade' }),
  turnoId: integer('turno_id').notNull().references(() => turnosCaja.id),
  metodo: text('metodo', { enum: METODOS_PAGO }).notNull(),
  montoCentavos: integer('monto_centavos').notNull(),
  referencia: text('referencia').notNull().default(''),
  recibidoCentavos: integer('recibido_centavos'),
  cambioCentavos: integer('cambio_centavos'),
  claveIdempotencia: text('clave_idempotencia'),
  creadoEn: text('creado_en').notNull().default(ahora),
});

export const bitacora = sqliteTable('bitacora', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  usuarioId: integer('usuario_id').references(() => usuarios.id),
  accion: text('accion').notNull(),
  entidad: text('entidad').notNull().default(''),
  entidadId: integer('entidad_id'),
  detalle: text('detalle').notNull().default(''),
  creadoEn: text('creado_en').notNull().default(ahora),
});
