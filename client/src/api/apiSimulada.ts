/* ════════════════════════════════════════════════════════════════════════
   API SIMULADA — para el modo demo publicado en GitHub Pages.

   GitHub Pages solo sirve archivos estáticos: no hay servidor ni base de
   datos ahí. Este módulo reimplementa, en el navegador, las mismas reglas
   de negocio del servidor real (server/src/modulos/*) sobre datos en
   memoria persistidos en localStorage, para que la interfaz completa
   responda a los clics de verdad sin necesitar ningún backend.

   No es el sistema real: es una maqueta fiel. Las reglas de dinero,
   idempotencia y autorización se replican a propósito, para que lo que se
   ve aquí sea representativo de cómo se comporta la aplicación de verdad.
   ════════════════════════════════════════════════════════════════════════ */

import { ErrorApi } from './errores';
import type {
  Barra,
  Categoria,
  Comanda,
  Config,
  Cuenta,
  Elemento,
  EstadoMesa,
  GrupoModificador,
  Mesa,
  MesaTablero,
  MetodoPago,
  Orden,
  Plano,
  Producto,
  ResumenTurno,
  Rol,
  Usuario,
  Zona,
} from '../tipos';
import { geometriaLugar } from '../tipos';

/* ── Aritmética de dinero, igual que server/src/modulos/dinero.ts ──────── */

function totalLinea(precioUnitarioCentavos: number, extrasCentavos: number, cantidadMilesimas: number): number {
  return Math.round(((precioUnitarioCentavos + extrasCentavos) * cantidadMilesimas) / 1000);
}

function repartir(importeCentavos: number, pesos: number[]): number[] {
  const suma = pesos.reduce((a, b) => a + b, 0);
  if (suma <= 0) return pesos.map(() => 0);
  const exactos = pesos.map((p) => (importeCentavos * p) / suma);
  const base = exactos.map((v) => Math.floor(v));
  let restante = importeCentavos - base.reduce((a, b) => a + b, 0);
  const porResto = exactos.map((v, i) => ({ i, resto: v - Math.floor(v) })).sort((a, b) => b.resto - a.resto || a.i - b.i);
  for (const { i } of porResto) {
    if (restante <= 0) break;
    base[i] = (base[i] ?? 0) + 1;
    restante--;
  }
  return base;
}

function calcularImpuesto(baseCentavos: number, tasaPorMil: number, incluido: boolean) {
  if (tasaPorMil <= 0) return { impuesto: 0, sumaAlTotal: 0 };
  if (incluido) {
    const sinImpuesto = Math.round((baseCentavos * 1000) / (1000 + tasaPorMil));
    return { impuesto: baseCentavos - sinImpuesto, sumaAlTotal: 0 };
  }
  const impuesto = Math.round((baseCentavos * tasaPorMil) / 1000);
  return { impuesto, sumaAlTotal: impuesto };
}

/* ── Modelo interno (una fila por entidad, como en las tablas del server) ─ */

interface UsuarioInterno { id: number; nombre: string; rol: Rol; pin: string; activo: boolean }
interface ZonaInterna { id: number; nombre: string; orden: number; activa: boolean; ancho: number; alto: number }
interface LayoutInterno { id: number; nombre: string; activo: boolean }
interface MesaInterna {
  id: number; zonaId: number; nombre: string; capacidad: number;
  forma: Mesa['forma']; activa: boolean; estado: EstadoMesa;
  barraId: number | null; numeroLugar: number | null;
}
interface PosicionInterna { layoutId: number; mesaId: number; x: number; y: number; ancho: number; alto: number; rotacion: number }
interface BarraInterna { id: number; zonaId: number; numero: number; lugares: number; activa: boolean }
interface PosicionBarraInterna { layoutId: number; barraId: number; x: number; y: number; ancho: number; alto: number; rotacion: number }
interface ElementoInterno {
  id: number; layoutId: number; zonaId: number; tipo: Elemento['tipo']; etiqueta: string;
  x: number; y: number; ancho: number; alto: number; rotacion: number;
}
interface CategoriaInterna { id: number; nombre: string; color: string; orden: number; activa: boolean }
interface ProductoInterno {
  id: number; categoriaId: number; nombre: string; descripcion: string;
  estacion: Producto['estacion']; tipoVenta: Producto['tipoVenta']; unidad: string;
  orden: number; activo: boolean; disponibleHoy: boolean;
}
interface VarianteInterna { id: number; productoId: number; nombre: string; precioCentavos: number; orden: number; activa: boolean }
interface GrupoInterno { id: number; nombre: string; minSelecciones: number; maxSelecciones: number; orden: number }
interface ModificadorInterno { id: number; grupoId: number; nombre: string; precioExtraCentavos: number; activo: boolean; orden: number }
interface ProductoGrupoInterno { productoId: number; grupoId: number; orden: number }
interface OrdenInterna {
  id: number; folio: number; mesaId: number; meseroId: number; comensales: number;
  estado: 'abierta' | 'cobrada' | 'cancelada'; abiertaEn: string; cerradaEn: string | null;
}
interface LineaInterna {
  id: number; ordenId: number; comandaId: number | null; productoId: number | null; varianteId: number | null;
  productoNombre: string; varianteNombre: string; estacion: Producto['estacion']; unidad: string;
  precioUnitarioCentavos: number; cantidadMilesimas: number; nota: string;
  estado: 'pendiente' | 'enviada' | 'lista' | 'servida' | 'cancelada';
  esCortesia: boolean; motivoCancelacion: string | null; canceladaPorId: number | null; creadoEn: string;
}
interface LineaModificadorInterno { id: number; lineaId: number; modificadorId: number | null; nombre: string; precioExtraCentavos: number }
interface ComandaInterna { id: number; ordenId: number; estacion: 'cocina' | 'barra'; enviadaEn: string; listaEn: string | null; claveIdempotencia: string | null }
interface CuentaInterna {
  id: number; ordenId: number; nombre: string; estado: 'abierta' | 'cobrada' | 'cancelada';
  subtotalCentavos: number; descuentoCentavos: number; motivoDescuento: string; autorizadoPorId: number | null;
  impuestoCentavos: number; propinaCentavos: number; totalCentavos: number; turnoId: number | null;
  cerradaEn: string | null; creadoEn: string;
}
interface CuentaLineaInterna { cuentaId: number; lineaId: number; proporcionMilesimas: number }
interface PagoInterno {
  id: number; cuentaId: number; turnoId: number; metodo: MetodoPago; montoCentavos: number; referencia: string;
  recibidoCentavos: number | null; cambioCentavos: number | null; claveIdempotencia: string | null; creadoEn: string;
}
interface TurnoInterno {
  id: number; usuarioId: number; abiertoEn: string; fondoInicialCentavos: number; cerradoEn: string | null;
  declaradoCentavos: number | null; esperadoCentavos: number | null; diferenciaCentavos: number | null;
  estado: 'abierto' | 'cerrado';
}
interface MovimientoInterno {
  id: number; turnoId: number; tipo: 'entrada' | 'retiro' | 'gasto' | 'propina_pagada';
  montoCentavos: number; concepto: string; usuarioId: number; creadoEn: string;
}
interface BitacoraInterna { id: number; usuarioId: number | null; accion: string; entidad: string; entidadId?: number; detalle: string; creadoEn: string }

interface Almacen {
  contador: number;
  usuarios: UsuarioInterno[];
  sesiones: Record<string, number>;
  zonas: ZonaInterna[];
  layouts: LayoutInterno[];
  mesas: MesaInterna[];
  posiciones: PosicionInterna[];
  barras: BarraInterna[];
  posicionesBarra: PosicionBarraInterna[];
  elementos: ElementoInterno[];
  categorias: CategoriaInterna[];
  productos: ProductoInterno[];
  variantes: VarianteInterna[];
  grupos: GrupoInterno[];
  modificadores: ModificadorInterno[];
  productoGrupos: ProductoGrupoInterno[];
  ordenes: OrdenInterna[];
  lineas: LineaInterna[];
  lineaModificadores: LineaModificadorInterno[];
  comandas: ComandaInterna[];
  cuentas: CuentaInterna[];
  cuentaLineas: CuentaLineaInterna[];
  pagos: PagoInterno[];
  turnos: TurnoInterno[];
  movimientos: MovimientoInterno[];
  bitacora: BitacoraInterna[];
  config: Config;
}

const CLAVE_ALMACEN = 'pos.demo.almacen';
const ahora = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

/* ── Siembra: el mismo comedor, equipo y menú que el servidor real ──────── */

function sembrar(): Almacen {
  let c = 0;
  const id = () => ++c;

  const almacen: Almacen = {
    contador: 0,
    usuarios: [], sesiones: {}, zonas: [], layouts: [], mesas: [], posiciones: [], barras: [], posicionesBarra: [], elementos: [],
    categorias: [], productos: [], variantes: [], grupos: [], modificadores: [], productoGrupos: [],
    ordenes: [], lineas: [], lineaModificadores: [], comandas: [], cuentas: [], cuentaLineas: [],
    pagos: [], turnos: [], movimientos: [], bitacora: [],
    config: {
      negocio_nombre: 'Mariscos Mazatlán', negocio_direccion: '', negocio_telefono: '',
      ticket_pie: '¡Gracias por su visita!', impuesto_tasa: '16', impuesto_incluido: '1',
      propina_sugerida: '10,15,20', menu_vista: 'cuadricula', menu_columnas: '3',
      menu_mostrar_precios: '1', menu_mostrar_descripcion: '0', menu_color_por_categoria: '1',
      menu_tamano_boton: 'grande', menu_agotados: 'atenuar',
    },
  };

  const equipo: { nombre: string; rol: Rol; pin: string }[] = [
    { nombre: 'Doña Rosa (dueña)', rol: 'admin', pin: '1234' },
    { nombre: 'Miguel (caja)', rol: 'cajero', pin: '2222' },
    { nombre: 'Luis', rol: 'mesero', pin: '3333' },
    { nombre: 'Karla', rol: 'mesero', pin: '4444' },
    { nombre: 'Cocina', rol: 'cocina', pin: '5555' },
  ];
  for (const u of equipo) almacen.usuarios.push({ id: id(), nombre: u.nombre, rol: u.rol, pin: u.pin, activo: true });

  const layout: LayoutInterno = { id: id(), nombre: 'Normal', activo: true };
  almacen.layouts.push(layout);

  const zona = (nombre: string, orden: number, ancho: number, alto: number): ZonaInterna => {
    const z = { id: id(), nombre, orden, activa: true, ancho, alto };
    almacen.zonas.push(z);
    return z;
  };
  const terraza = zona('Terraza', 0, 1200, 760);
  const salon = zona('Salón', 1, 1200, 760);
  const palapa = zona('Palapa', 2, 900, 700);

  const mesa = (zonaId: number, nombre: string, capacidad: number, forma: Mesa['forma'], x: number, y: number, ancho = 110, alto = 110) => {
    const m: MesaInterna = { id: id(), zonaId, nombre, capacidad, forma, activa: true, estado: 'libre', barraId: null, numeroLugar: null };
    almacen.mesas.push(m);
    almacen.posiciones.push({ layoutId: layout.id, mesaId: m.id, x, y, ancho, alto, rotacion: 0 });
    return m;
  };

  const barraGrupo = (zonaId: number, lugares: number, x: number, y: number, ancho: number, alto: number) => {
    const numero = almacen.barras.length + 1;
    const b: BarraInterna = { id: id(), zonaId, numero, lugares, activa: true };
    almacen.barras.push(b);
    almacen.posicionesBarra.push({ layoutId: layout.id, barraId: b.id, x, y, ancho, alto, rotacion: 0 });
    for (let i = 1; i <= lugares; i++) {
      almacen.mesas.push({ id: id(), zonaId, nombre: `B-${numero}-${i}`, capacidad: 1, forma: 'barra', activa: true, estado: 'libre', barraId: b.id, numeroLugar: i });
    }
    return b;
  };
  mesa(terraza.id, 'T-1', 4, 'cuadrada', 80, 100);
  mesa(terraza.id, 'T-2', 4, 'cuadrada', 260, 100);
  mesa(terraza.id, 'T-3', 6, 'redonda', 440, 80, 150, 150);
  mesa(terraza.id, 'T-4', 2, 'cuadrada', 680, 100, 90, 90);
  mesa(terraza.id, 'T-5', 4, 'cuadrada', 80, 300);
  mesa(terraza.id, 'T-6', 4, 'cuadrada', 260, 300);
  mesa(terraza.id, 'T-7', 8, 'rectangular', 440, 300, 240, 120);
  mesa(salon.id, 'S-1', 4, 'cuadrada', 100, 120);
  mesa(salon.id, 'S-2', 4, 'cuadrada', 280, 120);
  mesa(salon.id, 'S-3', 6, 'redonda', 460, 100, 150, 150);
  mesa(salon.id, 'S-4', 4, 'cuadrada', 100, 320);
  mesa(salon.id, 'S-5', 4, 'cuadrada', 280, 320);
  barraGrupo(salon.id, 4, 700, 140, 320, 70);
  mesa(palapa.id, 'P-1', 10, 'rectangular', 120, 140, 300, 130);
  mesa(palapa.id, 'P-2', 10, 'rectangular', 120, 340, 300, 130);
  mesa(palapa.id, 'P-3', 6, 'redonda', 520, 200, 160, 160);

  const elemento = (zonaId: number, tipo: Elemento['tipo'], etiqueta: string, x: number, y: number, ancho: number, alto: number) =>
    almacen.elementos.push({ id: id(), layoutId: layout.id, zonaId, tipo, etiqueta, x, y, ancho, alto, rotacion: 0 });
  elemento(terraza.id, 'texto', 'Vista al mar', 80, 20, 240, 50);
  elemento(salon.id, 'barra', 'Barra', 680, 60, 400, 60);
  elemento(salon.id, 'cocina', 'Cocina', 900, 400, 240, 200);
  elemento(salon.id, 'bano', 'Baños', 900, 640, 240, 90);
  elemento(palapa.id, 'planta', 'Palmera', 700, 460, 100, 100);

  const grupo = (nombre: string, min: number, max: number, opciones: [string, number][]): GrupoInterno => {
    const g: GrupoInterno = { id: id(), nombre, minSelecciones: min, maxSelecciones: max, orden: almacen.grupos.length };
    almacen.grupos.push(g);
    opciones.forEach(([n, precio], i) =>
      almacen.modificadores.push({ id: id(), grupoId: g.id, nombre: n, precioExtraCentavos: precio, activo: true, orden: i }),
    );
    return g;
  };
  const termino = grupo('Término', 1, 1, [['Bien cocido', 0], ['Término medio', 0], ['Jugoso', 0]]);
  const sinIngrediente = grupo('Sin ingrediente', 0, 4, [['Sin cebolla', 0], ['Sin cilantro', 0], ['Sin picante', 0], ['Sin limón', 0]]);
  const extras = grupo('Extras', 0, 3, [['Extra aguacate', 3500], ['Extra queso', 2500], ['Tortillas extra', 1500], ['Salsa aparte', 0]]);

  const categoria = (nombre: string, color: string, orden: number): CategoriaInterna => {
    const cat = { id: id(), nombre, color, orden, activa: true };
    almacen.categorias.push(cat);
    return cat;
  };
  const producto = (
    categoriaId: number, nombre: string, tipoVenta: Producto['tipoVenta'], precios: [string, number][],
    estacion: Producto['estacion'] = 'cocina', grupos: number[] = [], descripcion = '',
  ) => {
    const p: ProductoInterno = {
      id: id(), categoriaId, nombre, descripcion, estacion, tipoVenta,
      unidad: tipoVenta === 'peso' ? 'kg' : 'pieza', orden: almacen.productos.length, activo: true, disponibleHoy: true,
    };
    almacen.productos.push(p);
    precios.forEach(([n, precio], i) => almacen.variantes.push({ id: id(), productoId: p.id, nombre: n, precioCentavos: precio, orden: i, activa: true }));
    grupos.forEach((grupoId, i) => almacen.productoGrupos.push({ productoId: p.id, grupoId, orden: i }));
    return p;
  };

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

  almacen.contador = c;
  return almacen;
}

/* ── Persistencia en localStorage: el demo sobrevive a un refresh ──────── */

function cargar(): Almacen {
  try {
    const crudo = localStorage.getItem(CLAVE_ALMACEN);
    if (crudo) return JSON.parse(crudo) as Almacen;
  } catch {
    /* localStorage bloqueado o corrupto: se reconstruye desde cero */
  }
  const nuevo = sembrar();
  guardar(nuevo);
  return nuevo;
}

function guardar(a: Almacen) {
  try {
    localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(a));
  } catch {
    /* modo privado o cuota llena: el demo sigue funcionando en memoria */
  }
}

const A: Almacen = cargar();
const nuevoId = () => ++A.contador;
const persistir = () => guardar(A);

/** Botón de "reiniciar demo": vuelve a la siembra original. */
export function reiniciarDemo() {
  localStorage.removeItem(CLAVE_ALMACEN);
  location.reload();
}

function registrar(usuarioId: number | null, accion: string, entidad = '', entidadId?: number, detalle = '') {
  A.bitacora.unshift({ id: nuevoId(), usuarioId, accion, entidad, entidadId, detalle, creadoEn: ahora() });
}

/* ── Sesión ──────────────────────────────────────────────────────────── */

const usuarioPublico = (u: UsuarioInterno): Usuario => ({ id: u.id, nombre: u.nombre, rol: u.rol, activo: u.activo });

function usuarioDeToken(token: string | null): UsuarioInterno {
  const id = token ? A.sesiones[token] : undefined;
  const usuario = id !== undefined ? A.usuarios.find((u) => u.id === id) : undefined;
  if (!usuario || !usuario.activo) throw new ErrorApi('Sesión no válida. Vuelve a entrar con tu PIN.', 401);
  return usuario;
}

function autorizar(pin: string, roles: Rol[]): UsuarioInterno {
  const encontrado = A.usuarios.find((u) => u.activo && roles.includes(u.rol) && u.pin === pin);
  if (!encontrado) throw new ErrorApi('PIN de autorización inválido', 403);
  return encontrado;
}

/* ── Salón ───────────────────────────────────────────────────────────── */

function layoutActivo(): LayoutInterno {
  return A.layouts.find((l) => l.activo) ?? A.layouts[0]!;
}

function barraComoDTO(b: BarraInterna, layoutId: number): Barra {
  const pos = A.posicionesBarra.find((p) => p.layoutId === layoutId && p.barraId === b.id);
  return {
    id: b.id, zonaId: b.zonaId, numero: b.numero, lugares: b.lugares, activa: b.activa,
    x: pos?.x ?? 0, y: pos?.y ?? 0, ancho: pos?.ancho ?? 280, alto: pos?.alto ?? 70, rotacion: pos?.rotacion ?? 0,
  };
}

function construirPlano(layoutId?: number): Plano {
  const layout = layoutId ? A.layouts.find((l) => l.id === layoutId) : layoutActivo();
  if (!layout) throw new ErrorApi('Layout no encontrado', 404);

  const barrasDTO = A.barras.map((b) => barraComoDTO(b, layout.id));
  const barraPorId = new Map(barrasDTO.map((b) => [b.id, b]));

  const zonas: Zona[] = A.zonas
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .map((zona) => ({
      id: zona.id, nombre: zona.nombre, orden: zona.orden, activa: zona.activa, ancho: zona.ancho, alto: zona.alto,
      mesas: A.mesas
        .filter((m) => m.zonaId === zona.id)
        .map((m): Mesa => {
          if (m.barraId != null) {
            const barra = barraPorId.get(m.barraId);
            const geo = barra ? geometriaLugar(barra, (m.numeroLugar ?? 1) - 1, barra.lugares) : { x: 0, y: 0, ancho: 100, alto: 100, rotacion: 0 };
            return {
              id: m.id, zonaId: m.zonaId, nombre: m.nombre, capacidad: m.capacidad, forma: m.forma,
              activa: m.activa, estado: m.estado, barraId: m.barraId, numeroLugar: m.numeroLugar,
              ...geo, colocada: Boolean(barra),
            };
          }
          const pos = A.posiciones.find((p) => p.layoutId === layout.id && p.mesaId === m.id);
          return {
            id: m.id, zonaId: m.zonaId, nombre: m.nombre, capacidad: m.capacidad, forma: m.forma,
            activa: m.activa, estado: m.estado, barraId: null, numeroLugar: null,
            x: pos?.x ?? 0, y: pos?.y ?? 0, ancho: pos?.ancho ?? 100, alto: pos?.alto ?? 100, rotacion: pos?.rotacion ?? 0,
            colocada: Boolean(pos),
          };
        }),
      barras: barrasDTO.filter((b) => b.zonaId === zona.id),
      elementos: A.elementos
        .filter((e) => e.zonaId === zona.id && e.layoutId === layout.id)
        .map((e) => ({ ...e })),
    }));

  return { layout: { ...layout }, layouts: A.layouts.map((l) => ({ ...l })), zonas };
}

function mesaInterna(id: number): MesaInterna {
  const m = A.mesas.find((x) => x.id === id);
  if (!m) throw new ErrorApi('Mesa no encontrada', 404);
  return m;
}

function mesaComoDTO(m: MesaInterna, layoutId: number): Mesa {
  if (m.barraId != null) {
    const barra = A.barras.find((b) => b.id === m.barraId);
    const geo = barra ? geometriaLugar(barraComoDTO(barra, layoutId), (m.numeroLugar ?? 1) - 1, barra.lugares) : { x: 0, y: 0, ancho: 100, alto: 100, rotacion: 0 };
    return {
      id: m.id, zonaId: m.zonaId, nombre: m.nombre, capacidad: m.capacidad, forma: m.forma, activa: m.activa, estado: m.estado,
      barraId: m.barraId, numeroLugar: m.numeroLugar, ...geo, colocada: Boolean(barra),
    };
  }
  const pos = A.posiciones.find((p) => p.layoutId === layoutId && p.mesaId === m.id);
  return {
    id: m.id, zonaId: m.zonaId, nombre: m.nombre, capacidad: m.capacidad, forma: m.forma, activa: m.activa, estado: m.estado,
    barraId: null, numeroLugar: null,
    x: pos?.x ?? 0, y: pos?.y ?? 0, ancho: pos?.ancho ?? 100, alto: pos?.alto ?? 100, rotacion: pos?.rotacion ?? 0,
    colocada: Boolean(pos),
  };
}

/* ── Menú ────────────────────────────────────────────────────────────── */

function construirGrupos(): GrupoModificador[] {
  return A.grupos
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .map((g) => ({
      id: g.id, nombre: g.nombre, minSelecciones: g.minSelecciones, maxSelecciones: g.maxSelecciones, orden: g.orden,
      modificadores: A.modificadores.filter((m) => m.grupoId === g.id).sort((a, b) => a.orden - b.orden).map((m) => ({ ...m })),
    }));
}

function construirProducto(p: ProductoInterno, soloVendibles: boolean): Producto {
  const grupos = construirGrupos();
  return {
    id: p.id, categoriaId: p.categoriaId, nombre: p.nombre, descripcion: p.descripcion, estacion: p.estacion,
    tipoVenta: p.tipoVenta, unidad: p.unidad, orden: p.orden, activo: p.activo, disponibleHoy: p.disponibleHoy,
    variantes: A.variantes
      .filter((v) => v.productoId === p.id && (!soloVendibles || v.activa))
      .sort((a, b) => a.orden - b.orden)
      .map((v) => ({ ...v })),
    grupos: A.productoGrupos.filter((pg) => pg.productoId === p.id).map((pg) => grupos.find((g) => g.id === pg.grupoId)!).filter(Boolean),
  };
}

function construirMenu(soloVendibles: boolean): Categoria[] {
  const cats = A.categorias.filter((c) => !soloVendibles || c.activa).sort((a, b) => a.orden - b.orden);
  return cats.map((c) => ({
    id: c.id, nombre: c.nombre, color: c.color, orden: c.orden, activa: c.activa,
    productos: A.productos
      .filter((p) => p.categoriaId === c.id && (!soloVendibles || p.activo))
      .sort((a, b) => a.orden - b.orden)
      .map((p) => construirProducto(p, soloVendibles)),
  }));
}

/* ── Órdenes y cuentas: helpers compartidos ─────────────────────────────── */

function ordenAbiertaDeMesa(mesaId: number): OrdenInterna | undefined {
  return A.ordenes.find((o) => o.mesaId === mesaId && o.estado === 'abierta');
}

/** Una mesa con algún historial de órdenes (abiertas o ya cobradas) no se
 *  borra de verdad, igual que en el servidor real. */
function tieneHistorial(mesaId: number): boolean {
  return A.ordenes.some((o) => o.mesaId === mesaId);
}

function lineasDeOrden(ordenId: number) {
  return A.lineas
    .filter((l) => l.ordenId === ordenId)
    .map((l) => {
      const mods = A.lineaModificadores.filter((m) => m.lineaId === l.id);
      const extras = mods.reduce((a, m) => a + m.precioExtraCentavos, 0);
      const total = l.estado === 'cancelada' || l.esCortesia ? 0 : totalLinea(l.precioUnitarioCentavos, extras, l.cantidadMilesimas);
      const cuentaIds = A.cuentaLineas.filter((cl) => cl.lineaId === l.id).map((cl) => cl.cuentaId);
      return { ...l, modificadores: mods.map((m) => ({ id: m.id, nombre: m.nombre, precioExtraCentavos: m.precioExtraCentavos })), extrasCentavos: extras, totalCentavos: total, cuentaIds };
    });
}

function construirOrden(ordenId: number): Orden {
  const o = A.ordenes.find((x) => x.id === ordenId);
  if (!o) throw new ErrorApi('Orden no encontrada', 404);
  const mesa = mesaInterna(o.mesaId);
  const mesero = A.usuarios.find((u) => u.id === o.meseroId)!;
  return {
    id: o.id, folio: o.folio, mesaId: o.mesaId, mesaNombre: mesa.nombre, meseroId: o.meseroId, meseroNombre: mesero.nombre,
    comensales: o.comensales, estado: o.estado, abiertaEn: o.abiertaEn, cerradaEn: o.cerradaEn,
    lineas: lineasDeOrden(ordenId),
    cuentas: A.cuentas.filter((c) => c.ordenId === ordenId).map((c) => ({ ...c })),
  };
}

function subtotalesPorCuenta(ordenId: number): Map<number, number> {
  const lineas = lineasDeOrden(ordenId);
  const cuentasOrden = A.cuentas.filter((c) => c.ordenId === ordenId).map((c) => c.id);
  const totales = new Map<number, number>(cuentasOrden.map((id) => [id, 0]));
  for (const linea of lineas) {
    const asignaciones = A.cuentaLineas.filter((cl) => cl.lineaId === linea.id && cuentasOrden.includes(cl.cuentaId));
    if (!asignaciones.length) continue;
    const partes = repartir(linea.totalCentavos, asignaciones.map((a) => a.proporcionMilesimas));
    asignaciones.forEach((a, i) => totales.set(a.cuentaId, (totales.get(a.cuentaId) ?? 0) + (partes[i] ?? 0)));
  }
  return totales;
}

function calcularCuenta(cuentaId: number): CuentaInterna {
  const cuenta = A.cuentas.find((c) => c.id === cuentaId);
  if (!cuenta) throw new ErrorApi('Cuenta no encontrada', 404);
  if (cuenta.estado === 'cobrada') return cuenta;
  const subtotal = subtotalesPorCuenta(cuenta.ordenId).get(cuentaId) ?? 0;
  const descuento = Math.min(cuenta.descuentoCentavos, subtotal);
  const base = subtotal - descuento;
  const tasaPorMil = Math.round(Number(A.config.impuesto_tasa ?? '0') * 10);
  const incluido = A.config.impuesto_incluido === '1';
  const { impuesto, sumaAlTotal } = calcularImpuesto(base, tasaPorMil, incluido);
  const total = base + sumaAlTotal + cuenta.propinaCentavos;
  cuenta.subtotalCentavos = subtotal;
  cuenta.descuentoCentavos = descuento;
  cuenta.impuestoCentavos = impuesto;
  cuenta.totalCentavos = total;
  return cuenta;
}

function construirCuenta(cuentaId: number): Cuenta {
  const cuenta = A.cuentas.find((c) => c.id === cuentaId);
  if (!cuenta) throw new ErrorApi('Cuenta no encontrada', 404);
  const actualizada = cuenta.estado === 'abierta' ? calcularCuenta(cuentaId) : cuenta;
  const lineas = lineasDeOrden(actualizada.ordenId);
  const asignadas = A.cuentaLineas.filter((cl) => cl.cuentaId === cuentaId);
  return {
    ...actualizada,
    lineas: asignadas
      .map((a) => {
        const l = lineas.find((x) => x.id === a.lineaId);
        return l ? { ...l, proporcionMilesimas: a.proporcionMilesimas } : null;
      })
      .filter((l): l is NonNullable<typeof l> => Boolean(l)),
    pagos: A.pagos.filter((p) => p.cuentaId === cuentaId).map((p) => ({ id: p.id, metodo: p.metodo, montoCentavos: p.montoCentavos, referencia: p.referencia, recibidoCentavos: p.recibidoCentavos, cambioCentavos: p.cambioCentavos })),
  };
}

function cuentasDeOrden(ordenId: number): Cuenta[] {
  return A.cuentas.filter((c) => c.ordenId === ordenId).map((c) => construirCuenta(c.id));
}

/** Descarta cuentas vacías y cierra la orden si ya no queda ninguna con consumo. */
function cerrarOrdenSiProcede(ordenId: number): boolean {
  const abiertas = A.cuentas.filter((c) => c.ordenId === ordenId && c.estado === 'abierta');
  const vacias = abiertas.filter((c) => !A.cuentaLineas.some((cl) => cl.cuentaId === c.id));
  const conConsumo = abiertas.length - vacias.length;
  if (conConsumo > 0) return false;
  for (const v of vacias) A.cuentas = A.cuentas.filter((c) => c.id !== v.id);
  const orden = A.ordenes.find((o) => o.id === ordenId);
  if (!orden) return false;
  orden.estado = 'cobrada';
  orden.cerradaEn = ahora();
  mesaInterna(orden.mesaId).estado = 'por_limpiar';
  return true;
}

/* ── Caja ────────────────────────────────────────────────────────────── */

function turnoAbierto(): TurnoInterno | undefined {
  return A.turnos.find((t) => t.estado === 'abierto');
}

function exigirTurnoAbierto(): TurnoInterno {
  const t = turnoAbierto();
  if (!t) throw new ErrorApi('No hay un turno de caja abierto. Ábrelo antes de cobrar.', 409);
  return t;
}

function resumenTurno(turnoId: number): ResumenTurno {
  const turno = A.turnos.find((t) => t.id === turnoId);
  if (!turno) throw new ErrorApi('Turno no encontrado', 404);
  const pagosDelTurno = A.pagos.filter((p) => p.turnoId === turnoId);
  const porMetodo = (['efectivo', 'tarjeta', 'transferencia'] as MetodoPago[])
    .map((metodo) => ({ metodo, total: pagosDelTurno.filter((p) => p.metodo === metodo).reduce((a, p) => a + p.montoCentavos, 0), operaciones: pagosDelTurno.filter((p) => p.metodo === metodo).length }))
    .filter((m) => m.operaciones > 0);
  const cuentasCobradas = A.cuentas.filter((c) => c.turnoId === turnoId && c.estado === 'cobrada');
  const movimientos = A.movimientos.filter((m) => m.turnoId === turnoId).map((m) => ({ ...m, usuario: A.usuarios.find((u) => u.id === m.usuarioId)?.nombre ?? '—' }));
  const suma = (tipo: MovimientoInterno['tipo']) => movimientos.filter((m) => m.tipo === tipo).reduce((a, m) => a + m.montoCentavos, 0);
  const efectivoCobrado = porMetodo.find((m) => m.metodo === 'efectivo')?.total ?? 0;
  const entradas = suma('entrada');
  const salidas = suma('retiro') + suma('gasto') + suma('propina_pagada');
  return {
    turno: { ...turno },
    porMetodo,
    cuentasCobradas: cuentasCobradas.length,
    ventasCentavos: cuentasCobradas.reduce((a, c) => a + c.totalCentavos, 0),
    propinasCentavos: cuentasCobradas.reduce((a, c) => a + c.propinaCentavos, 0),
    descuentosCentavos: cuentasCobradas.reduce((a, c) => a + c.descuentoCentavos, 0),
    impuestosCentavos: cuentasCobradas.reduce((a, c) => a + c.impuestoCentavos, 0),
    movimientos,
    entradasCentavos: entradas,
    salidasCentavos: salidas,
    esperadoEfectivoCentavos: turno.fondoInicialCentavos + efectivoCobrado + entradas - salidas,
  };
}

/* ── Reportes ────────────────────────────────────────────────────────── */

function enRango(fecha: string | null, desde: string, hasta: string) {
  if (!fecha) return false;
  const dia = fecha.slice(0, 10);
  return dia >= desde && dia <= hasta;
}

/* ════════════════════════════════════════════════════════════════════════
   Superficie pública: el mismo contrato que `api` en cliente.ts
   ════════════════════════════════════════════════════════════════════════ */

const esperar = (ms = 90) => new Promise((r) => setTimeout(r, ms));

export const apiSimulada = {
  /* ── Sesión ─────────────────────────────────────────────────────── */
  usuariosActivos: async () => { await esperar(); return A.usuarios.filter((u) => u.activo).map(usuarioPublico); },
  ingresar: async (usuarioId: number, pin: string) => {
    await esperar();
    const u = A.usuarios.find((x) => x.id === usuarioId);
    if (!u || !u.activo || u.pin !== pin) throw new ErrorApi('PIN incorrecto', 401);
    const token = `demo-${u.id}-${Math.random().toString(36).slice(2)}`;
    A.sesiones[token] = u.id;
    registrar(u.id, 'ingreso', 'usuario', u.id);
    persistir();
    return { token, usuario: usuarioPublico(u) };
  },
  salir: async () => { await esperar(); return { ok: true as const }; },
  yo: async () => {
    await esperar();
    const token = localStorage.getItem('pos.token');
    return usuarioPublico(usuarioDeToken(token));
  },

  usuarios: async () => { await esperar(); return A.usuarios.map(usuarioPublico); },
  crearUsuario: async (datos: { nombre: string; rol: Rol; pin: string }) => {
    await esperar();
    const u: UsuarioInterno = { id: nuevoId(), nombre: datos.nombre, rol: datos.rol, pin: datos.pin, activo: true };
    A.usuarios.push(u);
    registrar(null, 'usuario_creado', 'usuario', u.id, `${u.nombre} (${u.rol})`);
    persistir();
    return usuarioPublico(u);
  },
  actualizarUsuario: async (id: number, cambios: { nombre?: string; rol?: Rol; pin?: string; activo?: boolean }) => {
    await esperar();
    const u = A.usuarios.find((x) => x.id === id);
    if (!u) throw new ErrorApi('Usuario no encontrado', 404);
    if ((cambios.activo === false || (cambios.rol && cambios.rol !== 'admin')) && u.rol === 'admin' && u.activo) {
      const admins = A.usuarios.filter((x) => x.rol === 'admin' && x.activo).length;
      if (admins <= 1) throw new ErrorApi('Debe quedar al menos un administrador activo', 409);
    }
    Object.assign(u, cambios);
    registrar(null, 'usuario_actualizado', 'usuario', id, Object.keys(cambios).join(', '));
    persistir();
    return usuarioPublico(u);
  },
  bitacora: async () => { await esperar(); return A.bitacora.slice(0, 200).map((b) => ({ ...b, usuario: A.usuarios.find((u) => u.id === b.usuarioId)?.nombre ?? null })); },

  /* ── Salón ──────────────────────────────────────────────────────── */
  plano: async (layoutId?: number) => { await esperar(); return construirPlano(layoutId); },
  crearLayout: async (nombre: string, copiarDeId?: number) => {
    await esperar();
    const nuevo: LayoutInterno = { id: nuevoId(), nombre, activo: false };
    A.layouts.push(nuevo);
    const origenId = copiarDeId ?? layoutActivo().id;
    for (const pos of A.posiciones.filter((p) => p.layoutId === origenId)) A.posiciones.push({ ...pos, layoutId: nuevo.id });
    for (const pos of A.posicionesBarra.filter((p) => p.layoutId === origenId)) A.posicionesBarra.push({ ...pos, layoutId: nuevo.id });
    for (const el of A.elementos.filter((e) => e.layoutId === origenId)) A.elementos.push({ ...el, id: nuevoId(), layoutId: nuevo.id });
    persistir();
    return { ...nuevo };
  },
  activarLayout: async (id: number) => {
    await esperar();
    const l = A.layouts.find((x) => x.id === id);
    if (!l) throw new ErrorApi('Layout no encontrado', 404);
    A.layouts.forEach((x) => (x.activo = false));
    l.activo = true;
    persistir();
    return { ...l };
  },
  eliminarLayout: async (id: number) => {
    await esperar();
    if (A.layouts.length <= 1) throw new ErrorApi('Debe existir al menos una distribución del comedor', 409);
    const l = A.layouts.find((x) => x.id === id);
    if (!l) throw new ErrorApi('Layout no encontrado', 404);
    A.layouts = A.layouts.filter((x) => x.id !== id);
    if (l.activo) A.layouts[0]!.activo = true;
    persistir();
    return { ...l };
  },

  crearZona: async (datos: { nombre: string; ancho?: number; alto?: number }) => {
    await esperar();
    const z: ZonaInterna = { id: nuevoId(), nombre: datos.nombre, orden: A.zonas.length, activa: true, ancho: datos.ancho ?? 1200, alto: datos.alto ?? 800 };
    A.zonas.push(z);
    persistir();
    return { ...z, mesas: [], elementos: [] };
  },
  actualizarZona: async (id: number, cambios: Partial<Pick<Zona, 'nombre' | 'ancho' | 'alto' | 'orden' | 'activa'>>) => {
    await esperar();
    const z = A.zonas.find((x) => x.id === id);
    if (!z) throw new ErrorApi('Zona no encontrada', 404);
    Object.assign(z, cambios);
    persistir();
    return { ...z, mesas: [], elementos: [] };
  },
  eliminarZona: async (id: number) => {
    await esperar();
    if (A.mesas.some((m) => m.zonaId === id)) throw new ErrorApi('La zona todavía tiene mesas. Muévelas o elimínalas primero.', 409);
    const z = A.zonas.find((x) => x.id === id);
    if (!z) throw new ErrorApi('Zona no encontrada', 404);
    A.zonas = A.zonas.filter((x) => x.id !== id);
    persistir();
    return { ...z, mesas: [], elementos: [] };
  },

  crearMesa: async (datos: Partial<Mesa> & { zonaId: number; nombre: string }, layoutId?: number) => {
    await esperar();
    const lid = layoutId ?? layoutActivo().id;
    const m: MesaInterna = { id: nuevoId(), zonaId: datos.zonaId, nombre: datos.nombre, capacidad: datos.capacidad ?? 4, forma: datos.forma ?? 'cuadrada', activa: true, estado: 'libre', barraId: null, numeroLugar: null };
    A.mesas.push(m);
    for (const l of A.layouts) A.posiciones.push({ layoutId: l.id, mesaId: m.id, x: datos.x ?? 0, y: datos.y ?? 0, ancho: datos.ancho ?? 100, alto: datos.alto ?? 100, rotacion: datos.rotacion ?? 0 });
    persistir();
    return mesaComoDTO(m, lid);
  },
  mesa: async (id: number, layoutId?: number) => { await esperar(); return mesaComoDTO(mesaInterna(id), layoutId ?? layoutActivo().id); },
  actualizarMesa: async (id: number, cambios: Partial<Mesa>, layoutId?: number) => {
    await esperar();
    const m = mesaInterna(id);
    const lid = layoutId ?? layoutActivo().id;
    if (m.barraId != null) {
      const prohibidos = (['nombre', 'capacidad', 'forma', 'zonaId', 'x', 'y', 'ancho', 'alto', 'rotacion'] as const).filter((c) => cambios[c] !== undefined);
      if (prohibidos.length) throw new ErrorApi('Este lugar pertenece a una barra: edita la barra completa para cambiar esto.', 409);
      if (cambios.activa !== undefined) m.activa = cambios.activa;
      if (cambios.estado !== undefined) m.estado = cambios.estado;
      persistir();
      return mesaComoDTO(m, lid);
    }
    for (const campo of ['nombre', 'capacidad', 'forma', 'zonaId', 'activa', 'estado'] as const) {
      if (cambios[campo] !== undefined) (m as unknown as Record<string, unknown>)[campo] = cambios[campo];
    }
    const pos = A.posiciones.find((p) => p.layoutId === lid && p.mesaId === id);
    if (pos) for (const campo of ['x', 'y', 'ancho', 'alto', 'rotacion'] as const) if (cambios[campo] !== undefined) pos[campo] = cambios[campo]!;
    persistir();
    return mesaComoDTO(m, lid);
  },
  cambiarEstadoMesa: async (id: number, estado: EstadoMesa) => {
    await esperar();
    const m = mesaInterna(id);
    m.estado = estado;
    persistir();
    return mesaComoDTO(m, layoutActivo().id);
  },
  eliminarMesa: async (id: number) => {
    await esperar();
    const m = mesaInterna(id);
    if (m.barraId != null) throw new ErrorApi('Este lugar pertenece a una barra: elimina o reduce la barra completa.', 409);
    if (tieneHistorial(id)) throw new ErrorApi('Esta mesa ya tiene historial de ventas: no se puede eliminar. Desactívala en su lugar ("Mesa en uso").', 409);
    A.mesas = A.mesas.filter((x) => x.id !== id);
    A.posiciones = A.posiciones.filter((p) => p.mesaId !== id);
    persistir();
    return mesaComoDTO(m, layoutActivo().id);
  },

  crearBarra: async (datos: Partial<Barra> & { zonaId: number; lugares: number }, layoutId?: number) => {
    await esperar();
    const lid = layoutId ?? layoutActivo().id;
    const numero = (A.barras.reduce((max, b) => Math.max(max, b.numero), 0)) + 1;
    const b: BarraInterna = { id: nuevoId(), zonaId: datos.zonaId, numero, lugares: datos.lugares, activa: true };
    A.barras.push(b);
    for (const l of A.layouts) A.posicionesBarra.push({ layoutId: l.id, barraId: b.id, x: datos.x ?? 0, y: datos.y ?? 0, ancho: datos.ancho ?? 280, alto: datos.alto ?? 70, rotacion: datos.rotacion ?? 0 });
    for (let i = 1; i <= datos.lugares; i++) {
      A.mesas.push({ id: nuevoId(), zonaId: datos.zonaId, nombre: `B-${numero}-${i}`, capacidad: 1, forma: 'barra', activa: true, estado: 'libre', barraId: b.id, numeroLugar: i });
    }
    persistir();
    return barraComoDTO(b, lid);
  },
  actualizarBarra: async (id: number, cambios: Partial<Barra>, layoutId?: number) => {
    await esperar();
    const lid = layoutId ?? layoutActivo().id;
    const b = A.barras.find((x) => x.id === id);
    if (!b) throw new ErrorApi('Barra no encontrada', 404);

    if (cambios.lugares !== undefined && cambios.lugares !== b.lugares) {
      if (cambios.lugares < b.lugares) {
        const aQuitar = A.mesas.filter((m) => m.barraId === id && (m.numeroLugar ?? 0) > cambios.lugares!);
        if (aQuitar.some((m) => ordenAbiertaDeMesa(m.id))) {
          throw new ErrorApi('No se puede reducir la barra: hay una cuenta abierta en un lugar que se eliminaría.', 409);
        }
        if (aQuitar.some((m) => tieneHistorial(m.id))) {
          throw new ErrorApi('No se puede reducir la barra: un lugar que se eliminaría ya tiene historial de ventas. Desactiva la barra en vez de reducirla.', 409);
        }
        A.mesas = A.mesas.filter((m) => !aQuitar.includes(m));
      } else {
        for (let i = b.lugares + 1; i <= cambios.lugares; i++) {
          A.mesas.push({ id: nuevoId(), zonaId: cambios.zonaId ?? b.zonaId, nombre: `B-${b.numero}-${i}`, capacidad: 1, forma: 'barra', activa: true, estado: 'libre', barraId: id, numeroLugar: i });
        }
      }
      b.lugares = cambios.lugares;
    }
    if (cambios.zonaId !== undefined) {
      b.zonaId = cambios.zonaId;
      for (const m of A.mesas) if (m.barraId === id) m.zonaId = cambios.zonaId;
    }
    if (cambios.activa !== undefined) {
      b.activa = cambios.activa;
      for (const m of A.mesas) if (m.barraId === id) m.activa = cambios.activa;
    }
    const pos = A.posicionesBarra.find((p) => p.layoutId === lid && p.barraId === id);
    if (pos) for (const campo of ['x', 'y', 'ancho', 'alto', 'rotacion'] as const) if (cambios[campo] !== undefined) pos[campo] = cambios[campo]!;
    persistir();
    return barraComoDTO(b, lid);
  },
  eliminarBarra: async (id: number) => {
    await esperar();
    const b = A.barras.find((x) => x.id === id);
    if (!b) throw new ErrorApi('Barra no encontrada', 404);
    const lugares = A.mesas.filter((m) => m.barraId === id);
    if (lugares.some((m) => ordenAbiertaDeMesa(m.id))) {
      throw new ErrorApi('No se puede eliminar la barra: hay una cuenta abierta en alguno de sus lugares.', 409);
    }
    if (lugares.some((m) => tieneHistorial(m.id))) {
      throw new ErrorApi('No se puede eliminar la barra: alguno de sus lugares ya tiene historial de ventas. Desactívala en su lugar.', 409);
    }
    A.mesas = A.mesas.filter((m) => m.barraId !== id);
    A.barras = A.barras.filter((x) => x.id !== id);
    A.posicionesBarra = A.posicionesBarra.filter((p) => p.barraId !== id);
    persistir();
    return barraComoDTO(b, layoutActivo().id);
  },

  crearElemento: async (datos: Partial<Elemento> & { zonaId: number }, layoutId?: number) => {
    await esperar();
    const e: ElementoInterno = { id: nuevoId(), layoutId: layoutId ?? layoutActivo().id, zonaId: datos.zonaId, tipo: datos.tipo ?? 'muro', etiqueta: datos.etiqueta ?? '', x: datos.x ?? 0, y: datos.y ?? 0, ancho: datos.ancho ?? 160, alto: datos.alto ?? 60, rotacion: datos.rotacion ?? 0 };
    A.elementos.push(e);
    persistir();
    return { ...e };
  },
  actualizarElemento: async (id: number, cambios: Partial<Elemento>) => {
    await esperar();
    const e = A.elementos.find((x) => x.id === id);
    if (!e) throw new ErrorApi('Elemento no encontrado', 404);
    Object.assign(e, cambios);
    persistir();
    return { ...e };
  },
  eliminarElemento: async (id: number) => {
    await esperar();
    const e = A.elementos.find((x) => x.id === id);
    if (!e) throw new ErrorApi('Elemento no encontrado', 404);
    A.elementos = A.elementos.filter((x) => x.id !== id);
    persistir();
    return { ...e };
  },

  guardarPosiciones: async (
    layoutId: number,
    lote: {
      mesas: ({ x: number; y: number; ancho: number; alto: number; rotacion: number } & { id: number })[];
      barras: ({ x: number; y: number; ancho: number; alto: number; rotacion: number } & { id: number })[];
      elementos: ({ x: number; y: number; ancho: number; alto: number; rotacion: number } & { id: number })[];
    },
  ) => {
    await esperar();
    for (const m of lote.mesas) {
      let pos = A.posiciones.find((p) => p.layoutId === layoutId && p.mesaId === m.id);
      if (!pos) { pos = { layoutId, mesaId: m.id, x: 0, y: 0, ancho: 100, alto: 100, rotacion: 0 }; A.posiciones.push(pos); }
      Object.assign(pos, { x: m.x, y: m.y, ancho: m.ancho, alto: m.alto, rotacion: m.rotacion });
    }
    for (const b of lote.barras) {
      let pos = A.posicionesBarra.find((p) => p.layoutId === layoutId && p.barraId === b.id);
      if (!pos) { pos = { layoutId, barraId: b.id, x: 0, y: 0, ancho: 280, alto: 70, rotacion: 0 }; A.posicionesBarra.push(pos); }
      Object.assign(pos, { x: b.x, y: b.y, ancho: b.ancho, alto: b.alto, rotacion: b.rotacion });
    }
    for (const e of lote.elementos) {
      const el = A.elementos.find((x) => x.id === e.id && x.layoutId === layoutId);
      if (el) Object.assign(el, { x: e.x, y: e.y, ancho: e.ancho, alto: e.alto, rotacion: e.rotacion });
    }
    persistir();
    return { mesas: lote.mesas.length, elementos: lote.elementos.length, barras: lote.barras.length };
  },

  /* ── Menú ───────────────────────────────────────────────────────── */
  menu: async (completo = false) => { await esperar(); return construirMenu(!completo); },
  grupos: async () => { await esperar(); return construirGrupos(); },
  disponibilidad: async (productoId: number, disponible: boolean) => {
    await esperar();
    const p = A.productos.find((x) => x.id === productoId);
    if (!p) throw new ErrorApi('Producto no encontrado', 404);
    p.disponibleHoy = disponible;
    registrar(null, disponible ? 'producto_disponible' : 'producto_agotado', 'producto', p.id, p.nombre);
    persistir();
    return construirProducto(p, false);
  },
  reabrirDisponibilidad: async () => {
    await esperar();
    let n = 0;
    for (const p of A.productos) if (!p.disponibleHoy) { p.disponibleHoy = true; n++; }
    persistir();
    return { reactivados: n };
  },

  crearCategoria: async (datos: { nombre: string; color?: string }) => {
    await esperar();
    const c: CategoriaInterna = { id: nuevoId(), nombre: datos.nombre, color: datos.color ?? '#13618c', orden: A.categorias.length, activa: true };
    A.categorias.push(c);
    persistir();
    return { ...c, productos: [] };
  },
  actualizarCategoria: async (id: number, cambios: { nombre?: string; color?: string; orden?: number; activa?: boolean }) => {
    await esperar();
    const c = A.categorias.find((x) => x.id === id);
    if (!c) throw new ErrorApi('Categoría no encontrada', 404);
    Object.assign(c, cambios);
    persistir();
    return { ...c, productos: [] };
  },
  eliminarCategoria: async (id: number) => {
    await esperar();
    if (A.productos.some((p) => p.categoriaId === id)) throw new ErrorApi('La categoría todavía tiene productos. Muévelos o elimínalos primero.', 409);
    const c = A.categorias.find((x) => x.id === id);
    if (!c) throw new ErrorApi('Categoría no encontrada', 404);
    A.categorias = A.categorias.filter((x) => x.id !== id);
    persistir();
    return { ...c, productos: [] };
  },

  crearProducto: async (datos: Record<string, unknown>) => {
    await esperar();
    const tipoVenta = (datos.tipoVenta as Producto['tipoVenta']) ?? 'simple';
    const p: ProductoInterno = {
      id: nuevoId(), categoriaId: datos.categoriaId as number, nombre: datos.nombre as string,
      descripcion: (datos.descripcion as string) ?? '', estacion: (datos.estacion as Producto['estacion']) ?? 'cocina',
      tipoVenta, unidad: tipoVenta === 'peso' ? 'kg' : 'pieza', orden: A.productos.length, activo: true, disponibleHoy: true,
    };
    A.productos.push(p);
    const variantesDatos = (datos.variantes as { nombre: string; precioCentavos: number }[]) ?? [];
    const lista = tipoVenta === 'variantes' && variantesDatos.length
      ? variantesDatos
      : [{ nombre: ({ simple: 'Único', peso: 'Por kilo', abierto: 'Precio del día' } as Record<string, string>)[tipoVenta] ?? 'Único', precioCentavos: (datos.precioCentavos as number) ?? 0 }];
    lista.forEach((v, i) => A.variantes.push({ id: nuevoId(), productoId: p.id, nombre: v.nombre, precioCentavos: v.precioCentavos, orden: i, activa: true }));
    ((datos.gruposIds as number[]) ?? []).forEach((grupoId, i) => A.productoGrupos.push({ productoId: p.id, grupoId, orden: i }));
    registrar(null, 'producto_creado', 'producto', p.id, p.nombre);
    persistir();
    return construirProducto(p, false);
  },
  actualizarProducto: async (id: number, cambios: Record<string, unknown>) => {
    await esperar();
    const p = A.productos.find((x) => x.id === id);
    if (!p) throw new ErrorApi('Producto no encontrado', 404);
    for (const campo of ['categoriaId', 'nombre', 'descripcion', 'estacion', 'activo', 'disponibleHoy', 'orden'] as const) {
      if (cambios[campo] !== undefined) (p as unknown as Record<string, unknown>)[campo] = cambios[campo];
    }
    if (cambios.tipoVenta && cambios.tipoVenta !== p.tipoVenta) {
      p.tipoVenta = cambios.tipoVenta as Producto['tipoVenta'];
      p.unidad = p.tipoVenta === 'peso' ? 'kg' : 'pieza';
      if (p.tipoVenta !== 'variantes') {
        const existentes = A.variantes.filter((v) => v.productoId === id).sort((a, b) => a.orden - b.orden);
        const primera = existentes[0];
        const nombre = { simple: 'Único', peso: 'Por kilo', abierto: 'Precio del día' }[p.tipoVenta] ?? 'Único';
        const precio = (cambios.precioCentavos as number) ?? primera?.precioCentavos ?? 0;
        if (primera) { primera.nombre = nombre; primera.precioCentavos = precio; primera.activa = true; for (const v of existentes.slice(1)) v.activa = false; }
        else A.variantes.push({ id: nuevoId(), productoId: id, nombre, precioCentavos: precio, orden: 0, activa: true });
      }
    } else if (cambios.precioCentavos !== undefined && p.tipoVenta !== 'variantes') {
      const primera = A.variantes.filter((v) => v.productoId === id).sort((a, b) => a.orden - b.orden)[0];
      if (primera) primera.precioCentavos = cambios.precioCentavos as number;
    }
    if (cambios.gruposIds) {
      A.productoGrupos = A.productoGrupos.filter((pg) => pg.productoId !== id);
      (cambios.gruposIds as number[]).forEach((grupoId, i) => A.productoGrupos.push({ productoId: id, grupoId, orden: i }));
    }
    if (cambios.precioCentavos !== undefined) registrar(null, 'precio_cambiado', 'producto', id, `${p.nombre}: ${cambios.precioCentavos}`);
    persistir();
    return construirProducto(p, false);
  },
  eliminarProducto: async (id: number) => {
    await esperar();
    const p = A.productos.find((x) => x.id === id);
    if (!p) throw new ErrorApi('Producto no encontrado', 404);
    p.activo = false;
    persistir();
    return construirProducto(p, false);
  },

  agregarVariante: async (productoId: number, datos: { nombre: string; precioCentavos: number }) => {
    await esperar();
    const p = A.productos.find((x) => x.id === productoId);
    if (!p) throw new ErrorApi('Producto no encontrado', 404);
    if (p.tipoVenta !== 'variantes') throw new ErrorApi('Este producto no maneja tamaños. Cámbialo a "varios tamaños" para agregarlos.', 409);
    const v: VarianteInterna = { id: nuevoId(), productoId, nombre: datos.nombre, precioCentavos: datos.precioCentavos, orden: A.variantes.filter((x) => x.productoId === productoId).length, activa: true };
    A.variantes.push(v);
    persistir();
    return { ...v };
  },
  actualizarVariante: async (id: number, cambios: { nombre?: string; precioCentavos?: number; activa?: boolean }) => {
    await esperar();
    const v = A.variantes.find((x) => x.id === id);
    if (!v) throw new ErrorApi('Variante no encontrada', 404);
    Object.assign(v, cambios);
    persistir();
    return { ...v };
  },
  eliminarVariante: async (id: number) => {
    await esperar();
    const v = A.variantes.find((x) => x.id === id);
    if (!v) throw new ErrorApi('Variante no encontrada', 404);
    const hermanas = A.variantes.filter((x) => x.productoId === v.productoId);
    if (hermanas.length <= 1) throw new ErrorApi('El producto debe conservar al menos un precio', 409);
    A.variantes = A.variantes.filter((x) => x.id !== id);
    persistir();
    return { ...v };
  },

  crearGrupo: async (datos: { nombre: string; minSelecciones: number; maxSelecciones: number; modificadores: { nombre: string; precioExtraCentavos: number }[] }) => {
    await esperar();
    const g: GrupoInterno = { id: nuevoId(), nombre: datos.nombre, minSelecciones: datos.minSelecciones, maxSelecciones: Math.max(datos.maxSelecciones, datos.minSelecciones), orden: A.grupos.length };
    A.grupos.push(g);
    datos.modificadores.forEach((m, i) => A.modificadores.push({ id: nuevoId(), grupoId: g.id, nombre: m.nombre, precioExtraCentavos: m.precioExtraCentavos, activo: true, orden: i }));
    persistir();
    return construirGrupos().find((x) => x.id === g.id)!;
  },
  actualizarGrupo: async (id: number, cambios: { nombre?: string; minSelecciones?: number; maxSelecciones?: number; orden?: number }) => {
    await esperar();
    const g = A.grupos.find((x) => x.id === id);
    if (!g) throw new ErrorApi('Grupo de modificadores no encontrado', 404);
    Object.assign(g, cambios);
    if (g.maxSelecciones < g.minSelecciones) g.maxSelecciones = g.minSelecciones;
    persistir();
    return construirGrupos().find((x) => x.id === id)!;
  },
  eliminarGrupo: async (id: number) => {
    await esperar();
    A.grupos = A.grupos.filter((g) => g.id !== id);
    A.modificadores = A.modificadores.filter((m) => m.grupoId !== id);
    A.productoGrupos = A.productoGrupos.filter((pg) => pg.grupoId !== id);
    persistir();
    return { ok: true };
  },
  crearModificador: async (datos: { grupoId: number; nombre: string; precioExtraCentavos: number }) => {
    await esperar();
    const m: ModificadorInterno = { id: nuevoId(), grupoId: datos.grupoId, nombre: datos.nombre, precioExtraCentavos: datos.precioExtraCentavos, activo: true, orden: A.modificadores.filter((x) => x.grupoId === datos.grupoId).length };
    A.modificadores.push(m);
    persistir();
    return { ...m };
  },
  actualizarModificador: async (id: number, cambios: { nombre?: string; precioExtraCentavos?: number; orden?: number; activo?: boolean }) => {
    await esperar();
    const m = A.modificadores.find((x) => x.id === id);
    if (!m) throw new ErrorApi('Modificador no encontrado', 404);
    Object.assign(m, cambios);
    persistir();
    return { ...m };
  },
  eliminarModificador: async (id: number) => {
    await esperar();
    A.modificadores = A.modificadores.filter((m) => m.id !== id);
    persistir();
    return { ok: true };
  },

  /* ── Órdenes ────────────────────────────────────────────────────── */
  tablero: async (): Promise<MesaTablero[]> => {
    await esperar();
    return A.mesas
      .filter((m) => m.activa)
      // Los lugares de una barra (B-1-1, B-1-2…, B-1-10) no se pueden ordenar
      // por nombre: "10" queda antes que "2" alfabéticamente. Se agrupan por
      // barra y se ordenan por su número de lugar; el resto, por nombre.
      .sort((a, b) => {
        const zonaA = A.zonas.find((z) => z.id === a.zonaId)!.orden;
        const zonaB = A.zonas.find((z) => z.id === b.zonaId)!.orden;
        if (zonaA !== zonaB) return zonaA - zonaB;
        const grupoA = a.barraId == null ? 0 : 1;
        const grupoB = b.barraId == null ? 0 : 1;
        if (grupoA !== grupoB) return grupoA - grupoB;
        if (grupoA === 0) return a.nombre.localeCompare(b.nombre);
        if (a.barraId !== b.barraId) return a.barraId! - b.barraId!;
        return (a.numeroLugar ?? 0) - (b.numeroLugar ?? 0);
      })
      .map((m) => {
        const zona = A.zonas.find((z) => z.id === m.zonaId)!;
        const orden = ordenAbiertaDeMesa(m.id);
        if (!orden) return { id: m.id, nombre: m.nombre, capacidad: m.capacidad, estado: m.estado, zonaId: zona.id, zona: zona.nombre, zonaOrden: zona.orden, orden: null };
        const lineas = A.lineas.filter((l) => l.ordenId === orden.id && l.estado !== 'cancelada');
        const total = lineas.reduce((a, l) => a + (l.esCortesia ? 0 : Math.round((l.precioUnitarioCentavos * l.cantidadMilesimas) / 1000)), 0);
        const cuentasAbiertas = A.cuentas.filter((c) => c.ordenId === orden.id && c.estado === 'abierta').length;
        return {
          id: m.id, nombre: m.nombre, capacidad: m.capacidad, estado: m.estado, zonaId: zona.id, zona: zona.nombre, zonaOrden: zona.orden,
          orden: {
            id: orden.id, folio: orden.folio, comensales: orden.comensales, abiertaEn: orden.abiertaEn, meseroId: orden.meseroId,
            mesero: A.usuarios.find((u) => u.id === orden.meseroId)?.nombre ?? '—', totalCentavos: total,
            sinEnviar: lineas.filter((l) => l.estado === 'pendiente').length, listas: lineas.filter((l) => l.estado === 'lista').length,
            cuentasAbiertas, vacia: lineas.length === 0,
          },
        };
      });
  },
  pedirCuenta: async (ordenId: number) => {
    await esperar();
    const o = A.ordenes.find((x) => x.id === ordenId);
    if (!o) throw new ErrorApi('Orden no encontrada', 404);
    mesaInterna(o.mesaId).estado = 'cuenta_pedida';
    persistir();
    return construirOrden(ordenId);
  },
  marcarEntregado: async (ordenId: number) => {
    await esperar();
    const o = A.ordenes.find((x) => x.id === ordenId);
    if (!o) throw new ErrorApi('Orden no encontrada', 404);
    if (o.estado !== 'abierta') throw new ErrorApi('La orden ya está cerrada', 409);
    A.lineas.filter((l) => l.ordenId === ordenId && l.estado === 'lista').forEach((l) => { l.estado = 'servida'; });
    persistir();
    return construirOrden(ordenId);
  },
  cancelarMesaVacia: async (ordenId: number) => {
    await esperar();
    const o = A.ordenes.find((x) => x.id === ordenId);
    if (!o) throw new ErrorApi('Orden no encontrada', 404);
    if (A.lineas.some((l) => l.ordenId === ordenId && l.estado !== 'cancelada')) throw new ErrorApi('Esta mesa ya tiene consumo. Cancela los platillos con autorización antes de cerrarla.', 409);
    o.estado = 'cancelada';
    o.cerradaEn = ahora();
    mesaInterna(o.mesaId).estado = 'libre';
    A.cuentas = A.cuentas.filter((c) => c.ordenId !== ordenId);
    persistir();
    return { ok: true as const };
  },
  ordenDeMesa: async (mesaId: number) => { await esperar(); const o = ordenAbiertaDeMesa(mesaId); return o ? construirOrden(o.id) : null; },
  orden: async (id: number) => { await esperar(); return construirOrden(id); },
  abrirOrden: async (mesaId: number, comensales: number) => {
    await esperar();
    const m = mesaInterna(mesaId);
    if (!m.activa) throw new ErrorApi('Esa mesa está desactivada', 409);
    if (ordenAbiertaDeMesa(mesaId)) throw new ErrorApi('La mesa ya tiene una orden abierta', 409);
    const token = localStorage.getItem('pos.token');
    const mesero = usuarioDeToken(token);
    const folio = (A.ordenes.reduce((max, o) => Math.max(max, o.folio), 0)) + 1;
    const o: OrdenInterna = { id: nuevoId(), folio, mesaId, meseroId: mesero.id, comensales, estado: 'abierta', abiertaEn: ahora(), cerradaEn: null };
    A.ordenes.push(o);
    A.cuentas.push({ id: nuevoId(), ordenId: o.id, nombre: 'Cuenta 1', estado: 'abierta', subtotalCentavos: 0, descuentoCentavos: 0, motivoDescuento: '', autorizadoPorId: null, impuestoCentavos: 0, propinaCentavos: 0, totalCentavos: 0, turnoId: null, cerradaEn: null, creadoEn: ahora() });
    m.estado = 'ocupada';
    persistir();
    return construirOrden(o.id);
  },
  agregarLineas: async (ordenId: number, lineas: { varianteId: number; cantidadMilesimas: number; nota: string; modificadoresIds: number[]; precioCentavos?: number }[], cuentaId?: number) => {
    await esperar();
    const o = A.ordenes.find((x) => x.id === ordenId);
    if (!o) throw new ErrorApi('Orden no encontrada', 404);
    if (o.estado !== 'abierta') throw new ErrorApi('La orden ya está cerrada', 409);
    const destino = cuentaId
      ? A.cuentas.find((c) => c.id === cuentaId && c.ordenId === ordenId)
      : A.cuentas.filter((c) => c.ordenId === ordenId && c.estado === 'abierta')[0];
    if (!destino) throw new ErrorApi('Cuenta no encontrada', 404);
    for (const entrada of lineas) {
      const variante = A.variantes.find((v) => v.id === entrada.varianteId);
      const producto = variante && A.productos.find((p) => p.id === variante.productoId);
      if (!variante || !producto) throw new ErrorApi('Producto no encontrado', 404);
      if (!producto.activo) throw new ErrorApi(`${producto.nombre} ya no está en el menú`, 409);
      if (!producto.disponibleHoy) throw new ErrorApi(`${producto.nombre} está agotado hoy`, 409);
      const precio = producto.tipoVenta === 'abierto' ? entrada.precioCentavos ?? -1 : variante.precioCentavos;
      if (precio < 0) throw new ErrorApi(`${producto.nombre} se vende a precio del día: hay que capturar el precio`, 400);
      const linea: LineaInterna = {
        id: nuevoId(), ordenId, comandaId: null, productoId: producto.id, varianteId: variante.id, productoNombre: producto.nombre,
        varianteNombre: producto.tipoVenta === 'variantes' ? variante.nombre : '', estacion: producto.estacion, unidad: producto.unidad,
        precioUnitarioCentavos: precio, cantidadMilesimas: entrada.cantidadMilesimas, nota: entrada.nota, estado: 'pendiente',
        esCortesia: false, motivoCancelacion: null, canceladaPorId: null, creadoEn: ahora(),
      };
      A.lineas.push(linea);
      for (const modId of entrada.modificadoresIds) {
        const mod = A.modificadores.find((m) => m.id === modId);
        if (mod) A.lineaModificadores.push({ id: nuevoId(), lineaId: linea.id, modificadorId: mod.id, nombre: mod.nombre, precioExtraCentavos: mod.precioExtraCentavos });
      }
      A.cuentaLineas.push({ cuentaId: destino.id, lineaId: linea.id, proporcionMilesimas: 1000 });
    }
    persistir();
    return construirOrden(ordenId);
  },
  actualizarLinea: async (id: number, cambios: { cantidadMilesimas?: number; nota?: string }) => {
    await esperar();
    const l = A.lineas.find((x) => x.id === id);
    if (!l) throw new ErrorApi('Línea no encontrada', 404);
    if (l.estado !== 'pendiente') throw new ErrorApi('Ese platillo ya se envió a cocina. Cancélalo con autorización si es necesario.', 409);
    Object.assign(l, cambios);
    persistir();
    return { ...l };
  },
  eliminarLinea: async (id: number) => {
    await esperar();
    const l = A.lineas.find((x) => x.id === id);
    if (!l) throw new ErrorApi('Línea no encontrada', 404);
    if (l.estado !== 'pendiente') throw new ErrorApi('Ese platillo ya se envió a cocina. Cancélalo con autorización.', 409);
    A.lineas = A.lineas.filter((x) => x.id !== id);
    A.lineaModificadores = A.lineaModificadores.filter((m) => m.lineaId !== id);
    A.cuentaLineas = A.cuentaLineas.filter((cl) => cl.lineaId !== id);
    persistir();
    return { ...l };
  },
  cancelarLinea: async (id: number, datos: { motivo: string; pinAutorizacion: string; esCortesia: boolean }) => {
    await esperar();
    const autorizador = autorizar(datos.pinAutorizacion, ['admin', 'cajero']);
    const l = A.lineas.find((x) => x.id === id);
    if (!l) throw new ErrorApi('Línea no encontrada', 404);
    if (l.estado === 'cancelada') throw new ErrorApi('Esa línea ya estaba cancelada', 409);
    if (datos.esCortesia) { l.esCortesia = true; l.motivoCancelacion = datos.motivo; l.canceladaPorId = autorizador.id; }
    else { l.estado = 'cancelada'; l.motivoCancelacion = datos.motivo; l.canceladaPorId = autorizador.id; }
    registrar(null, datos.esCortesia ? 'linea_cortesia' : 'linea_cancelada', 'orden_linea', id, `${l.productoNombre} · ${datos.motivo} · autorizó ${autorizador.nombre}`);
    persistir();
    return { ...l };
  },
  enviarComanda: async (ordenId: number, claveIdempotencia: string) => {
    await esperar();
    const previas = A.comandas.filter((c) => c.claveIdempotencia?.startsWith(`${claveIdempotencia}:`));
    if (previas.length) return { comandas: previas.map(mapComanda), repetida: true, orden: construirOrden(ordenId) };
    const o = A.ordenes.find((x) => x.id === ordenId);
    if (!o) throw new ErrorApi('Orden no encontrada', 404);
    if (o.estado !== 'abierta') throw new ErrorApi('La orden ya está cerrada', 409);
    const pendientes = A.lineas.filter((l) => l.ordenId === ordenId && l.estado === 'pendiente');
    if (!pendientes.length) throw new ErrorApi('No hay nada pendiente por enviar', 409);
    const creadas: ComandaInterna[] = [];
    for (const estacion of ['cocina', 'barra'] as const) {
      const suyas = pendientes.filter((l) => l.estacion === estacion);
      if (!suyas.length) continue;
      const comanda: ComandaInterna = { id: nuevoId(), ordenId, estacion, enviadaEn: ahora(), listaEn: null, claveIdempotencia: `${claveIdempotencia}:${estacion}` };
      A.comandas.push(comanda);
      for (const l of suyas) { l.estado = 'enviada'; l.comandaId = comanda.id; }
      creadas.push(comanda);
    }
    persistir();
    return { comandas: creadas.map(mapComanda), repetida: false, orden: construirOrden(ordenId) };
  },
  transferirOrden: async (ordenId: number, mesaDestinoId: number) => {
    await esperar();
    const o = A.ordenes.find((x) => x.id === ordenId);
    if (!o) throw new ErrorApi('Orden no encontrada', 404);
    if (o.estado !== 'abierta') throw new ErrorApi('La orden ya está cerrada', 409);
    if (ordenAbiertaDeMesa(mesaDestinoId)) throw new ErrorApi('La mesa destino ya tiene una orden abierta', 409);
    mesaInterna(o.mesaId).estado = 'por_limpiar';
    mesaInterna(mesaDestinoId).estado = 'ocupada';
    o.mesaId = mesaDestinoId;
    persistir();
    return construirOrden(ordenId);
  },

  comandasPendientes: async (estacion?: 'cocina' | 'barra') => {
    await esperar();
    const ordenesAbiertas = new Set(A.ordenes.filter((o) => o.estado === 'abierta').map((o) => o.id));
    return A.comandas
      .filter((c) => !c.listaEn && ordenesAbiertas.has(c.ordenId) && (!estacion || c.estacion === estacion))
      .sort((a, b) => a.enviadaEn.localeCompare(b.enviadaEn))
      .map(mapComandaConLineas);
  },
  comandaLista: async (id: number) => {
    await esperar();
    const c = A.comandas.find((x) => x.id === id);
    if (!c) throw new ErrorApi('Comanda no encontrada', 404);
    if (!c.listaEn) {
      c.listaEn = ahora();
      for (const l of A.lineas) if (l.comandaId === id && l.estado === 'enviada') l.estado = 'lista';
    }
    persistir();
    return { ...c };
  },

  /* ── Cuentas ────────────────────────────────────────────────────── */
  cuentas: async (ordenId: number) => { await esperar(); return cuentasDeOrden(ordenId); },
  crearCuenta: async (ordenId: number, nombre?: string) => {
    await esperar();
    const o = A.ordenes.find((x) => x.id === ordenId);
    if (!o) throw new ErrorApi('Orden no encontrada', 404);
    if (o.estado !== 'abierta') throw new ErrorApi('La orden ya está cerrada', 409);
    const n = A.cuentas.filter((c) => c.ordenId === ordenId).length;
    const c: CuentaInterna = { id: nuevoId(), ordenId, nombre: nombre ?? `Cuenta ${n + 1}`, estado: 'abierta', subtotalCentavos: 0, descuentoCentavos: 0, motivoDescuento: '', autorizadoPorId: null, impuestoCentavos: 0, propinaCentavos: 0, totalCentavos: 0, turnoId: null, cerradaEn: null, creadoEn: ahora() };
    A.cuentas.push(c);
    persistir();
    return construirCuenta(c.id);
  },
  eliminarCuenta: async (id: number) => {
    await esperar();
    const c = A.cuentas.find((x) => x.id === id);
    if (!c) throw new ErrorApi('Cuenta no encontrada', 404);
    if (c.estado === 'cobrada') throw new ErrorApi('Una cuenta cobrada no se elimina', 409);
    const hermanas = A.cuentas.filter((x) => x.ordenId === c.ordenId);
    if (hermanas.length <= 1) throw new ErrorApi('La orden debe conservar al menos una cuenta', 409);
    const destino = hermanas.find((x) => x.id !== id && x.estado === 'abierta');
    if (!destino) throw new ErrorApi('No hay otra cuenta abierta a la cual mover el consumo', 409);
    for (const cl of A.cuentaLineas.filter((x) => x.cuentaId === id)) {
      if (!A.cuentaLineas.some((x) => x.cuentaId === destino.id && x.lineaId === cl.lineaId)) A.cuentaLineas.push({ ...cl, cuentaId: destino.id });
    }
    A.cuentaLineas = A.cuentaLineas.filter((x) => x.cuentaId !== id);
    A.cuentas = A.cuentas.filter((x) => x.id !== id);
    persistir();
    return { ...c };
  },
  asignarLinea: async (cuentaId: number, lineaId: number, proporcionMilesimas = 1000) => {
    await esperar();
    const cuenta = A.cuentas.find((c) => c.id === cuentaId);
    if (!cuenta) throw new ErrorApi('Cuenta no encontrada', 404);
    if (cuenta.estado !== 'abierta') throw new ErrorApi('Esa cuenta ya fue cobrada', 409);
    const linea = A.lineas.find((l) => l.id === lineaId);
    if (!linea) throw new ErrorApi('Línea no encontrada', 404);
    if (linea.ordenId !== cuenta.ordenId) throw new ErrorApi('Ese platillo no pertenece a esta mesa', 409);
    const hermanas = A.cuentas.filter((c) => c.ordenId === cuenta.ordenId).map((c) => c.id);
    A.cuentaLineas = A.cuentaLineas.filter((cl) => !(cl.lineaId === lineaId && hermanas.includes(cl.cuentaId)));
    A.cuentaLineas.push({ cuentaId, lineaId, proporcionMilesimas });
    persistir();
    return cuentasDeOrden(cuenta.ordenId);
  },
  moverUnidades: async (lineaIds: number[], cantidadMilesimas: number, cuentaDestinoId: number) => {
    await esperar();
    const destino = A.cuentas.find((c) => c.id === cuentaDestinoId);
    if (!destino) throw new ErrorApi('Cuenta no encontrada', 404);
    if (destino.estado !== 'abierta') throw new ErrorApi('Esa cuenta ya fue cobrada', 409);
    const lineas = lineaIds.map((id) => A.lineas.find((l) => l.id === id)).filter((l): l is LineaInterna => Boolean(l));
    if (lineas.length !== lineaIds.length) throw new ErrorApi('Línea no encontrada', 404);
    if (lineas.some((l) => l.ordenId !== destino.ordenId)) throw new ErrorApi('Ese platillo no pertenece a esta mesa', 409);
    const disponible = lineas.reduce((a, l) => a + l.cantidadMilesimas, 0);
    if (cantidadMilesimas > disponible) throw new ErrorApi('No hay esa cantidad para mover', 400);

    let restante = cantidadMilesimas;
    for (const linea of lineas) {
      if (restante <= 0) break;
      const mover = Math.min(linea.cantidadMilesimas, restante);
      let lineaMovidaId = linea.id;
      if (mover !== linea.cantidadMilesimas) {
        const nueva: LineaInterna = { ...linea, id: nuevoId(), cantidadMilesimas: mover };
        A.lineas.push(nueva);
        lineaMovidaId = nueva.id;
        linea.cantidadMilesimas -= mover;
        for (const m of A.lineaModificadores.filter((x) => x.lineaId === linea.id)) {
          A.lineaModificadores.push({ id: nuevoId(), lineaId: nueva.id, modificadorId: m.modificadorId, nombre: m.nombre, precioExtraCentavos: m.precioExtraCentavos });
        }
      }
      A.cuentaLineas = A.cuentaLineas.filter((cl) => cl.lineaId !== lineaMovidaId);
      A.cuentaLineas.push({ cuentaId: destino.id, lineaId: lineaMovidaId, proporcionMilesimas: 1000 });
      restante -= mover;
    }
    persistir();
    return cuentasDeOrden(destino.ordenId);
  },
  repartirLinea: async (lineaId: number, cuentaIds: number[]) => {
    await esperar();
    const destinos = A.cuentas.filter((c) => cuentaIds.includes(c.id));
    if (destinos.length !== cuentaIds.length) throw new ErrorApi('Cuenta no encontrada', 404);
    if (destinos.some((c) => c.estado !== 'abierta')) throw new ErrorApi('Alguna de esas cuentas ya fue cobrada', 409);
    const ordenId = destinos[0]!.ordenId;
    if (destinos.some((c) => c.ordenId !== ordenId)) throw new ErrorApi('Las cuentas deben ser de la misma mesa', 409);
    const linea = A.lineas.find((l) => l.id === lineaId);
    if (!linea) throw new ErrorApi('Línea no encontrada', 404);
    if (linea.ordenId !== ordenId) throw new ErrorApi('Ese platillo no pertenece a esta mesa', 409);
    const hermanas = A.cuentas.filter((c) => c.ordenId === ordenId).map((c) => c.id);
    A.cuentaLineas = A.cuentaLineas.filter((cl) => !(cl.lineaId === lineaId && hermanas.includes(cl.cuentaId)));
    for (const destino of destinos) A.cuentaLineas.push({ cuentaId: destino.id, lineaId, proporcionMilesimas: 1000 });
    persistir();
    return cuentasDeOrden(ordenId);
  },
  dividirEnPartes: async (ordenId: number, partes: number) => {
    await esperar();
    const o = A.ordenes.find((x) => x.id === ordenId);
    if (!o) throw new ErrorApi('Orden no encontrada', 404);
    if (o.estado !== 'abierta') throw new ErrorApi('La orden ya está cerrada', 409);
    const existentes = A.cuentas.filter((c) => c.ordenId === ordenId);
    if (existentes.some((c) => c.estado === 'cobrada')) throw new ErrorApi('Ya se cobró una parte de esta orden: no se puede volver a dividir', 409);
    for (const c of existentes.slice(1)) A.cuentas = A.cuentas.filter((x) => x.id !== c.id);
    let primera = existentes[0];
    if (!primera) { primera = { id: nuevoId(), ordenId, nombre: 'Cuenta 1', estado: 'abierta', subtotalCentavos: 0, descuentoCentavos: 0, motivoDescuento: '', autorizadoPorId: null, impuestoCentavos: 0, propinaCentavos: 0, totalCentavos: 0, turnoId: null, cerradaEn: null, creadoEn: ahora() }; A.cuentas.push(primera); }
    const nuevas = [primera];
    while (nuevas.length < partes) {
      const c: CuentaInterna = { id: nuevoId(), ordenId, nombre: `Cuenta ${nuevas.length + 1}`, estado: 'abierta', subtotalCentavos: 0, descuentoCentavos: 0, motivoDescuento: '', autorizadoPorId: null, impuestoCentavos: 0, propinaCentavos: 0, totalCentavos: 0, turnoId: null, cerradaEn: null, creadoEn: ahora() };
      A.cuentas.push(c);
      nuevas.push(c);
    }
    const lineas = A.lineas.filter((l) => l.ordenId === ordenId && l.estado !== 'cancelada');
    for (const cuenta of nuevas) {
      A.cuentaLineas = A.cuentaLineas.filter((cl) => cl.cuentaId !== cuenta.id);
      for (const l of lineas) A.cuentaLineas.push({ cuentaId: cuenta.id, lineaId: l.id, proporcionMilesimas: 1000 });
    }
    persistir();
    return cuentasDeOrden(ordenId);
  },
  aplicarDescuento: async (cuentaId: number, datos: { tipo: 'monto' | 'porcentaje'; valor: number; motivo: string; pinAutorizacion: string }) => {
    await esperar();
    const autorizador = autorizar(datos.pinAutorizacion, ['admin', 'cajero']);
    const cuenta = calcularCuenta(cuentaId);
    if (cuenta.estado !== 'abierta') throw new ErrorApi('Esa cuenta ya fue cobrada', 409);
    const monto = datos.tipo === 'porcentaje' ? Math.round((cuenta.subtotalCentavos * Math.min(datos.valor, 100)) / 100) : Math.min(datos.valor, cuenta.subtotalCentavos);
    cuenta.descuentoCentavos = monto;
    cuenta.motivoDescuento = datos.motivo;
    cuenta.autorizadoPorId = autorizador.id;
    registrar(null, 'descuento_aplicado', 'cuenta', cuentaId, `${monto} · ${datos.motivo} · autorizó ${autorizador.nombre}`);
    persistir();
    return construirCuenta(cuentaId);
  },
  establecerPropina: async (cuentaId: number, propinaCentavos: number) => {
    await esperar();
    const cuenta = A.cuentas.find((c) => c.id === cuentaId);
    if (!cuenta) throw new ErrorApi('Cuenta no encontrada', 404);
    if (cuenta.estado !== 'abierta') throw new ErrorApi('Esa cuenta ya fue cobrada', 409);
    cuenta.propinaCentavos = propinaCentavos;
    persistir();
    return construirCuenta(cuentaId);
  },
  cobrar: async (cuentaId: number, pagosNuevos: { metodo: MetodoPago; montoCentavos: number; referencia: string; recibidoCentavos?: number }[], claveIdempotencia: string) => {
    await esperar();
    if (A.pagos.some((p) => p.claveIdempotencia === `${claveIdempotencia}:0`)) {
      const c = A.cuentas.find((x) => x.id === cuentaId);
      return { repetido: true, ordenCerrada: c?.estado === 'cobrada' && !A.ordenes.some((o) => o.id === c.ordenId && o.estado === 'abierta') };
    }
    const turno = exigirTurnoAbierto();
    const cuenta = calcularCuenta(cuentaId);
    if (cuenta.estado !== 'abierta') throw new ErrorApi('Esa cuenta ya fue cobrada', 409);
    const suma = pagosNuevos.reduce((a, p) => a + p.montoCentavos, 0);
    if (suma !== cuenta.totalCentavos) throw new ErrorApi(`Los pagos suman ${suma} y la cuenta es de ${cuenta.totalCentavos}`, 400);
    pagosNuevos.forEach((p, i) => {
      const cambio = p.metodo === 'efectivo' && p.recibidoCentavos !== undefined ? Math.max(0, p.recibidoCentavos - p.montoCentavos) : null;
      A.pagos.push({ id: nuevoId(), cuentaId, turnoId: turno.id, metodo: p.metodo, montoCentavos: p.montoCentavos, referencia: p.referencia, recibidoCentavos: p.recibidoCentavos ?? null, cambioCentavos: cambio, claveIdempotencia: `${claveIdempotencia}:${i}`, creadoEn: ahora() });
    });
    cuenta.estado = 'cobrada';
    cuenta.turnoId = turno.id;
    cuenta.cerradaEn = ahora();
    const ordenCerrada = cerrarOrdenSiProcede(cuenta.ordenId);
    registrar(null, 'cuenta_cobrada', 'cuenta', cuentaId, `${cuenta.totalCentavos} centavos`);
    persistir();
    return { repetido: false, ordenCerrada };
  },
  reabrirCuenta: async (cuentaId: number, datos: { motivo: string; pinAutorizacion: string }) => {
    await esperar();
    const autorizador = autorizar(datos.pinAutorizacion, ['admin']);
    const cuenta = A.cuentas.find((c) => c.id === cuentaId);
    if (!cuenta) throw new ErrorApi('Cuenta no encontrada', 404);
    if (cuenta.estado !== 'cobrada') throw new ErrorApi('Esa cuenta no está cobrada', 409);
    const orden = A.ordenes.find((o) => o.id === cuenta.ordenId)!;
    const activaEnMesa = ordenAbiertaDeMesa(orden.mesaId);
    if (activaEnMesa && activaEnMesa.id !== orden.id) throw new ErrorApi('Esa mesa ya está sirviendo a otro grupo. No se puede reabrir esta cuenta ahí.', 409);
    A.pagos = A.pagos.filter((p) => p.cuentaId !== cuentaId);
    cuenta.estado = 'abierta';
    cuenta.cerradaEn = null;
    cuenta.turnoId = null;
    orden.estado = 'abierta';
    orden.cerradaEn = null;
    mesaInterna(orden.mesaId).estado = 'ocupada';
    registrar(null, 'cuenta_reabierta', 'cuenta', cuentaId, `${datos.motivo} · autorizó ${autorizador.nombre}`);
    persistir();
    return { ...cuenta };
  },

  /* ── Caja ───────────────────────────────────────────────────────── */
  turnoActual: async () => { await esperar(); const t = turnoAbierto(); return t ? resumenTurno(t.id) : null; },
  turnos: async () => { await esperar(); return A.turnos.map((t) => ({ ...t, usuario: A.usuarios.find((u) => u.id === t.usuarioId)?.nombre ?? '—' })); },
  abrirTurno: async (fondoInicialCentavos: number) => {
    await esperar();
    if (turnoAbierto()) throw new ErrorApi('Ya hay un turno de caja abierto', 409);
    const token = localStorage.getItem('pos.token');
    const usuario = usuarioDeToken(token);
    const t: TurnoInterno = { id: nuevoId(), usuarioId: usuario.id, abiertoEn: ahora(), fondoInicialCentavos, cerradoEn: null, declaradoCentavos: null, esperadoCentavos: null, diferenciaCentavos: null, estado: 'abierto' };
    A.turnos.push(t);
    registrar(usuario.id, 'turno_abierto', 'turno_caja', t.id, `fondo ${fondoInicialCentavos}`);
    persistir();
    return { ...t };
  },
  movimientoCaja: async (datos: { tipo: 'entrada' | 'retiro' | 'gasto' | 'propina_pagada'; montoCentavos: number; concepto: string }) => {
    await esperar();
    const turno = exigirTurnoAbierto();
    const token = localStorage.getItem('pos.token');
    const usuario = usuarioDeToken(token);
    const m: MovimientoInterno = { id: nuevoId(), turnoId: turno.id, tipo: datos.tipo, montoCentavos: datos.montoCentavos, concepto: datos.concepto, usuarioId: usuario.id, creadoEn: ahora() };
    A.movimientos.push(m);
    registrar(usuario.id, `caja_${datos.tipo}`, 'movimiento_caja', m.id, datos.concepto);
    persistir();
    return { ...m };
  },
  cerrarTurno: async (turnoId: number, declaradoCentavos: number) => {
    await esperar();
    const resumen = resumenTurno(turnoId);
    if (resumen.turno.estado === 'cerrado') throw new ErrorApi('Ese turno ya está cerrado', 409);
    if (A.cuentas.some((c) => c.estado === 'abierta')) {
      const n = A.cuentas.filter((c) => c.estado === 'abierta').length;
      throw new ErrorApi(`Todavía hay ${n} cuenta(s) sin cobrar. Ciérralas antes del corte.`, 409);
    }
    const turno = A.turnos.find((t) => t.id === turnoId)!;
    const esperado = resumen.esperadoEfectivoCentavos;
    turno.estado = 'cerrado';
    turno.cerradoEn = ahora();
    turno.declaradoCentavos = declaradoCentavos;
    turno.esperadoCentavos = esperado;
    turno.diferenciaCentavos = declaradoCentavos - esperado;
    registrar(null, 'turno_cerrado', 'turno_caja', turnoId, `diferencia ${declaradoCentavos - esperado}`);
    persistir();
    return { ...resumen, turno: { ...turno }, diferenciaCentavos: declaradoCentavos - esperado };
  },

  /* ── Reportes ───────────────────────────────────────────────────── */
  reporteVentas: async (desde: string, hasta: string) => {
    await esperar();
    const cobradas = A.cuentas.filter((c) => c.estado === 'cobrada' && enRango(c.cerradaEn, desde, hasta));
    const pagosDelRango = A.pagos.filter((p) => cobradas.some((c) => c.id === p.cuentaId));
    const porMetodo = (['efectivo', 'tarjeta', 'transferencia'] as MetodoPago[])
      .map((metodo) => ({ metodo, total: pagosDelRango.filter((p) => p.metodo === metodo).reduce((a, p) => a + p.montoCentavos, 0), operaciones: pagosDelRango.filter((p) => p.metodo === metodo).length }))
      .filter((m) => m.operaciones > 0);
    const ventasCentavos = cobradas.reduce((a, c) => a + c.totalCentavos, 0);
    return {
      desde, hasta, cuentas: cobradas.length, ventasCentavos,
      propinasCentavos: cobradas.reduce((a, c) => a + c.propinaCentavos, 0),
      descuentosCentavos: cobradas.reduce((a, c) => a + c.descuentoCentavos, 0),
      impuestosCentavos: cobradas.reduce((a, c) => a + c.impuestoCentavos, 0),
      ticketPromedioCentavos: cobradas.length ? Math.round(ventasCentavos / cobradas.length) : 0,
      porMetodo,
    };
  },
  reporteProductos: async (desde: string, hasta: string) => {
    await esperar();
    const ordenesEnRango = new Set(A.ordenes.filter((o) => enRango(o.abiertaEn, desde, hasta)).map((o) => o.id));
    const activas = A.lineas.filter((l) => ordenesEnRango.has(l.ordenId) && l.estado !== 'cancelada');
    const grupos = new Map<string, { producto: string; variante: string; cantidad: number; importeCentavos: number }>();
    for (const l of activas) {
      const clave = `${l.productoNombre}|${l.varianteNombre}`;
      const actual = grupos.get(clave) ?? { producto: l.productoNombre, variante: l.varianteNombre, cantidad: 0, importeCentavos: 0 };
      actual.cantidad += l.cantidadMilesimas / 1000;
      actual.importeCentavos += Math.round((l.precioUnitarioCentavos * l.cantidadMilesimas) / 1000);
      grupos.set(clave, actual);
    }
    return [...grupos.values()].sort((a, b) => b.cantidad - a.cantidad).slice(0, 20);
  },
  reporteMeseros: async (desde: string, hasta: string) => {
    await esperar();
    const cobradas = A.cuentas.filter((c) => c.estado === 'cobrada' && enRango(c.cerradaEn, desde, hasta));
    const porMesero = new Map<string, { mesero: string; cuentas: number; ventasCentavos: number; propinasCentavos: number }>();
    for (const c of cobradas) {
      const orden = A.ordenes.find((o) => o.id === c.ordenId)!;
      const nombre = A.usuarios.find((u) => u.id === orden.meseroId)?.nombre ?? '—';
      const actual = porMesero.get(nombre) ?? { mesero: nombre, cuentas: 0, ventasCentavos: 0, propinasCentavos: 0 };
      actual.cuentas++; actual.ventasCentavos += c.totalCentavos; actual.propinasCentavos += c.propinaCentavos;
      porMesero.set(nombre, actual);
    }
    return [...porMesero.values()].sort((a, b) => b.ventasCentavos - a.ventasCentavos);
  },
  reporteCancelaciones: async (desde: string, hasta: string) => {
    await esperar();
    return A.lineas
      .filter((l) => (l.estado === 'cancelada' || l.esCortesia) && enRango(l.creadoEn, desde, hasta))
      .map((l) => ({
        id: l.id, producto: l.productoNombre, importeCentavos: Math.round((l.precioUnitarioCentavos * l.cantidadMilesimas) / 1000),
        motivo: l.motivoCancelacion, esCortesia: l.esCortesia,
        autorizo: A.usuarios.find((u) => u.id === l.canceladaPorId)?.nombre ?? null,
        folio: A.ordenes.find((o) => o.id === l.ordenId)?.folio ?? 0,
      }))
      .sort((a, b) => b.id - a.id);
  },

  /* ── Configuración ──────────────────────────────────────────────── */
  config: async () => { await esperar(); return { ...A.config }; },
  guardarConfig: async (cambios: Config) => { await esperar(); Object.assign(A.config, cambios); persistir(); return { ...A.config }; },
};

function mapComanda(c: ComandaInterna): Comanda {
  const orden = A.ordenes.find((o) => o.id === c.ordenId);
  return {
    id: c.id, ordenId: c.ordenId, folio: orden?.folio ?? 0,
    mesa: orden ? mesaInterna(orden.mesaId).nombre : '', mesero: orden ? A.usuarios.find((u) => u.id === orden.meseroId)?.nombre ?? '' : '',
    estacion: c.estacion, enviadaEn: c.enviadaEn, listaEn: c.listaEn, lineas: [],
  };
}

function mapComandaConLineas(c: ComandaInterna): Comanda {
  const base = mapComanda(c);
  const lineas = lineasDeOrden(c.ordenId).filter((l) => l.comandaId === c.id && l.estado !== 'cancelada');
  return { ...base, lineas: lineas.map((l) => ({ ...l, modificadores: l.modificadores })) };
}
