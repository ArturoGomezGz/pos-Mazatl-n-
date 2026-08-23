export type FormaMesa = 'cuadrada' | 'redonda' | 'rectangular' | 'barra';
export type EstadoMesa = 'libre' | 'ocupada' | 'cuenta_pedida' | 'por_limpiar' | 'reservada';
export type TipoElemento = 'muro' | 'barra' | 'cocina' | 'bano' | 'planta' | 'texto';

export interface Geometria {
  x: number;
  y: number;
  ancho: number;
  alto: number;
  rotacion: number;
}

export interface Mesa extends Geometria {
  id: number;
  zonaId: number;
  nombre: string;
  capacidad: number;
  forma: FormaMesa;
  activa: boolean;
  estado: EstadoMesa;
  colocada: boolean;
}

export interface Elemento extends Geometria {
  id: number;
  zonaId: number;
  tipo: TipoElemento;
  etiqueta: string;
}

export interface Zona {
  id: number;
  nombre: string;
  orden: number;
  activa: boolean;
  ancho: number;
  alto: number;
  mesas: Mesa[];
  elementos: Elemento[];
}

export interface Layout {
  id: number;
  nombre: string;
  activo: boolean;
}

export interface Plano {
  layout: Layout;
  layouts: Layout[];
  zonas: Zona[];
}

/** Qué está seleccionado en el editor. */
export type Seleccion = { tipo: 'mesa' | 'elemento'; id: number } | null;

export const ETIQUETAS_ESTADO: Record<EstadoMesa, string> = {
  libre: 'Libre',
  ocupada: 'Ocupada',
  cuenta_pedida: 'Cuenta pedida',
  por_limpiar: 'Por limpiar',
  reservada: 'Reservada',
};

export const ETIQUETAS_FORMA: Record<FormaMesa, string> = {
  cuadrada: 'Cuadrada',
  redonda: 'Redonda',
  rectangular: 'Rectangular',
  barra: 'Lugar de barra',
};

export const ETIQUETAS_ELEMENTO: Record<TipoElemento, string> = {
  muro: 'Muro',
  barra: 'Barra',
  cocina: 'Cocina',
  bano: 'Baños',
  planta: 'Planta',
  texto: 'Texto',
};

/* ── Usuarios ────────────────────────────────────────────────────────── */

export type Rol = 'admin' | 'cajero' | 'mesero' | 'cocina';

export interface Usuario {
  id: number;
  nombre: string;
  rol: Rol;
  activo?: boolean;
}

export const ETIQUETAS_ROL: Record<Rol, string> = {
  admin: 'Administrador',
  cajero: 'Cajero',
  mesero: 'Mesero',
  cocina: 'Cocina',
};

/* ── Menú ────────────────────────────────────────────────────────────── */

export type Estacion = 'cocina' | 'barra';
export type TipoVenta = 'simple' | 'variantes' | 'peso' | 'abierto';

export const ETIQUETAS_TIPO_VENTA: Record<TipoVenta, string> = {
  simple: 'Precio único',
  variantes: 'Varios tamaños',
  peso: 'Por peso (kg)',
  abierto: 'Precio del día',
};

export const AYUDA_TIPO_VENTA: Record<TipoVenta, string> = {
  simple: 'Un solo precio. Lo más común: guacamole, refresco, cerveza.',
  variantes: 'Tamaños con precio propio: orden y media orden, chico / mediano / grande.',
  peso: 'Se cobra por kilo y el peso se captura al vender: mojarra, camarón por kilo.',
  abierto: 'El precio se captura en la venta: pescado del día, mariscada.',
};

export interface Variante {
  id: number;
  productoId: number;
  nombre: string;
  precioCentavos: number;
  orden: number;
  activa: boolean;
}

export interface Modificador {
  id: number;
  grupoId: number;
  nombre: string;
  precioExtraCentavos: number;
  activo: boolean;
}

export interface GrupoModificador {
  id: number;
  nombre: string;
  minSelecciones: number;
  maxSelecciones: number;
  orden: number;
  modificadores: Modificador[];
}

export interface Producto {
  id: number;
  categoriaId: number;
  nombre: string;
  descripcion: string;
  estacion: Estacion;
  tipoVenta: TipoVenta;
  unidad: string;
  orden: number;
  activo: boolean;
  disponibleHoy: boolean;
  variantes: Variante[];
  grupos: GrupoModificador[];
}

export interface Categoria {
  id: number;
  nombre: string;
  color: string;
  orden: number;
  activa: boolean;
  productos: Producto[];
}

/* ── Órdenes ─────────────────────────────────────────────────────────── */

export type EstadoLinea = 'pendiente' | 'enviada' | 'lista' | 'servida' | 'cancelada';

export interface LineaModificador {
  id: number;
  nombre: string;
  precioExtraCentavos: number;
}

export interface Linea {
  id: number;
  ordenId: number;
  comandaId: number | null;
  productoId: number | null;
  varianteId: number | null;
  productoNombre: string;
  varianteNombre: string;
  estacion: Estacion;
  unidad: string;
  precioUnitarioCentavos: number;
  cantidadMilesimas: number;
  nota: string;
  estado: EstadoLinea;
  esCortesia: boolean;
  motivoCancelacion: string | null;
  modificadores: LineaModificador[];
  extrasCentavos: number;
  totalCentavos: number;
  cuentaIds?: number[];
}

export interface Orden {
  id: number;
  folio: number;
  mesaId: number;
  mesaNombre: string;
  meseroId: number;
  meseroNombre: string;
  comensales: number;
  estado: 'abierta' | 'cobrada' | 'cancelada';
  abiertaEn: string;
  cerradaEn: string | null;
  lineas: Linea[];
  cuentas: CuentaBase[];
}

export interface CuentaBase {
  id: number;
  ordenId: number;
  nombre: string;
  estado: 'abierta' | 'cobrada' | 'cancelada';
  subtotalCentavos: number;
  descuentoCentavos: number;
  motivoDescuento: string;
  impuestoCentavos: number;
  propinaCentavos: number;
  totalCentavos: number;
  cerradaEn: string | null;
}

export interface Pago {
  id: number;
  metodo: MetodoPago;
  montoCentavos: number;
  referencia: string;
  recibidoCentavos: number | null;
  cambioCentavos: number | null;
}

export interface Cuenta extends CuentaBase {
  lineas: (Linea & { proporcionMilesimas: number })[];
  pagos: Pago[];
}

export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia';

export const ETIQUETAS_METODO: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
};

export interface Comanda {
  id: number;
  ordenId: number;
  folio: number;
  mesa: string;
  mesero: string;
  estacion: Estacion;
  enviadaEn: string;
  listaEn: string | null;
  lineas: (Linea & { modificadores: LineaModificador[] })[];
}

/* ── Caja ────────────────────────────────────────────────────────────── */

export interface Turno {
  id: number;
  usuarioId: number;
  abiertoEn: string;
  fondoInicialCentavos: number;
  cerradoEn: string | null;
  estado: 'abierto' | 'cerrado';
  declaradoCentavos: number | null;
  esperadoCentavos: number | null;
  diferenciaCentavos: number | null;
}

export interface MovimientoCaja {
  id: number;
  tipo: 'entrada' | 'retiro' | 'gasto' | 'propina_pagada';
  montoCentavos: number;
  concepto: string;
  creadoEn: string;
  usuario: string;
}

export interface ResumenTurno {
  turno: Turno;
  porMetodo: { metodo: MetodoPago; total: number; operaciones: number }[];
  cuentasCobradas: number;
  ventasCentavos: number;
  propinasCentavos: number;
  descuentosCentavos: number;
  impuestosCentavos: number;
  movimientos: MovimientoCaja[];
  entradasCentavos: number;
  salidasCentavos: number;
  esperadoEfectivoCentavos: number;
  diferenciaCentavos?: number;
}

/* ── Configuración y estilo del menú ─────────────────────────────────── */

export type Config = Record<string, string>;

export interface EstiloMenu {
  vista: 'cuadricula' | 'lista';
  columnas: number;
  mostrarPrecios: boolean;
  mostrarDescripcion: boolean;
  colorPorCategoria: boolean;
  tamanoBoton: 'comodo' | 'grande';
  agotados: 'atenuar' | 'ocultar';
}

export function leerEstiloMenu(config: Config): EstiloMenu {
  return {
    vista: config.menu_vista === 'lista' ? 'lista' : 'cuadricula',
    columnas: Number(config.menu_columnas ?? 3),
    mostrarPrecios: config.menu_mostrar_precios !== '0',
    mostrarDescripcion: config.menu_mostrar_descripcion === '1',
    colorPorCategoria: config.menu_color_por_categoria !== '0',
    tamanoBoton: config.menu_tamano_boton === 'comodo' ? 'comodo' : 'grande',
    agotados: config.menu_agotados === 'ocultar' ? 'ocultar' : 'atenuar',
  };
}

/* ── Dinero ──────────────────────────────────────────────────────────── */

export const pesos = (centavos: number) =>
  (centavos / 100).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

export const cantidadLegible = (milesimas: number, unidad: string) =>
  unidad === 'kg' ? `${(milesimas / 1000).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')} kg` : String(milesimas / 1000);
