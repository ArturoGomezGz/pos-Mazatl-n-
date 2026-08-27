import type {
  Barra,
  Categoria,
  Comanda,
  Config,
  Cuenta,
  Elemento,
  EstadoMesa,
  GrupoModificador,
  Layout,
  Mesa,
  MesaTablero,
  MetodoPago,
  Orden,
  Plano,
  Producto,
  ResumenTurno,
  Rol,
  Turno,
  Usuario,
  Zona,
} from '../tipos';

export { ErrorApi } from './errores';
import { ErrorApi } from './errores';

const CLAVE_TOKEN = 'pos.token';

export const sesionGuardada = {
  leer: () => localStorage.getItem(CLAVE_TOKEN),
  guardar: (token: string) => localStorage.setItem(CLAVE_TOKEN, token),
  borrar: () => localStorage.removeItem(CLAVE_TOKEN),
};

/** Se dispara cuando el servidor rechaza la sesión: la app manda al ingreso. */
let alPerderSesion: () => void = () => {};
export const configurarPerdidaDeSesion = (fn: () => void) => {
  alPerderSesion = fn;
};

async function peticion<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const token = sesionGuardada.leer();
  let respuesta: Response;
  try {
    respuesta = await fetch(`/api${ruta}`, {
      ...opciones,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...opciones.headers,
      },
    });
  } catch {
    // En el restaurante esto casi siempre es el Wi-Fi, no un bug: dilo así.
    throw new ErrorApi('No hay conexión con el servidor del restaurante', 0);
  }

  if (respuesta.status === 204) return undefined as T;

  const cuerpo = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    if (respuesta.status === 401) {
      sesionGuardada.borrar();
      alPerderSesion();
    }
    const mensaje =
      (cuerpo && typeof cuerpo === 'object' && 'error' in cuerpo && String(cuerpo.error)) || 'Error inesperado';
    throw new ErrorApi(mensaje, respuesta.status, cuerpo && (cuerpo as { detalle?: unknown }).detalle);
  }
  return cuerpo as T;
}

const json = (body: unknown) => ({ body: JSON.stringify(body ?? {}) });
const conLayout = (ruta: string, layoutId?: number) => (layoutId ? `${ruta}?layout=${layoutId}` : ruta);

/** Clave única por acción para que un reintento de red no cobre ni mande dos veces. */
export const nuevaClave = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

type Geometria = { x: number; y: number; ancho: number; alto: number; rotacion: number };

const apiReal = {
  /* ── Sesión ─────────────────────────────────────────────────────── */
  usuariosActivos: () => peticion<Usuario[]>('/auth/usuarios-activos'),
  ingresar: (usuarioId: number, pin: string) =>
    peticion<{ token: string; usuario: Usuario }>('/auth/ingresar', { method: 'POST', ...json({ usuarioId, pin }) }),
  salir: () => peticion<{ ok: true }>('/auth/salir', { method: 'POST' }),
  yo: () => peticion<Usuario>('/auth/yo'),

  usuarios: () => peticion<Usuario[]>('/auth/usuarios'),
  crearUsuario: (datos: { nombre: string; rol: Rol; pin: string }) =>
    peticion<Usuario>('/auth/usuarios', { method: 'POST', ...json(datos) }),
  actualizarUsuario: (id: number, cambios: { nombre?: string; rol?: Rol; pin?: string; activo?: boolean }) =>
    peticion<Usuario>(`/auth/usuarios/${id}`, { method: 'PATCH', ...json(cambios) }),
  bitacora: () =>
    peticion<{ id: number; accion: string; entidad: string; detalle: string; creadoEn: string; usuario: string | null }[]>(
      '/auth/bitacora',
    ),

  /* ── Salón ──────────────────────────────────────────────────────── */
  plano: (layoutId?: number) => peticion<Plano>(conLayout('/salon/plano', layoutId)),
  crearLayout: (nombre: string, copiarDeId?: number) =>
    peticion<Layout>('/salon/layouts', { method: 'POST', ...json({ nombre, copiarDeId }) }),
  activarLayout: (id: number) => peticion<Layout>(`/salon/layouts/${id}`, { method: 'PATCH', ...json({ activo: true }) }),
  eliminarLayout: (id: number) => peticion<Layout>(`/salon/layouts/${id}`, { method: 'DELETE' }),

  crearZona: (datos: { nombre: string; ancho?: number; alto?: number }) =>
    peticion<Zona>('/salon/zonas', { method: 'POST', ...json(datos) }),
  actualizarZona: (id: number, cambios: Partial<Pick<Zona, 'nombre' | 'ancho' | 'alto' | 'orden' | 'activa'>>) =>
    peticion<Zona>(`/salon/zonas/${id}`, { method: 'PATCH', ...json(cambios) }),
  eliminarZona: (id: number) => peticion<Zona>(`/salon/zonas/${id}`, { method: 'DELETE' }),

  crearMesa: (datos: Partial<Mesa> & { zonaId: number; nombre: string }, layoutId?: number) =>
    peticion<Mesa>(conLayout('/salon/mesas', layoutId), { method: 'POST', ...json(datos) }),
  mesa: (id: number, layoutId?: number) => peticion<Mesa>(conLayout(`/salon/mesas/${id}`, layoutId)),
  actualizarMesa: (id: number, cambios: Partial<Mesa>, layoutId?: number) =>
    peticion<Mesa>(conLayout(`/salon/mesas/${id}`, layoutId), { method: 'PATCH', ...json(cambios) }),
  cambiarEstadoMesa: (id: number, estado: EstadoMesa) =>
    peticion<Mesa>(`/salon/mesas/${id}/estado`, { method: 'POST', ...json({ estado }) }),
  eliminarMesa: (id: number) => peticion<Mesa>(`/salon/mesas/${id}`, { method: 'DELETE' }),

  crearBarra: (datos: Partial<Barra> & { zonaId: number; lugares: number }, layoutId?: number) =>
    peticion<Barra>(conLayout('/salon/barras', layoutId), { method: 'POST', ...json(datos) }),
  actualizarBarra: (id: number, cambios: Partial<Barra>, layoutId?: number) =>
    peticion<Barra>(conLayout(`/salon/barras/${id}`, layoutId), { method: 'PATCH', ...json(cambios) }),
  eliminarBarra: (id: number) => peticion<Barra>(`/salon/barras/${id}`, { method: 'DELETE' }),

  crearElemento: (datos: Partial<Elemento> & { zonaId: number }, layoutId?: number) =>
    peticion<Elemento>(conLayout('/salon/elementos', layoutId), { method: 'POST', ...json(datos) }),
  actualizarElemento: (id: number, cambios: Partial<Elemento>) =>
    peticion<Elemento>(`/salon/elementos/${id}`, { method: 'PATCH', ...json(cambios) }),
  eliminarElemento: (id: number) => peticion<Elemento>(`/salon/elementos/${id}`, { method: 'DELETE' }),

  guardarPosiciones: (
    layoutId: number,
    lote: { mesas: (Geometria & { id: number })[]; barras: (Geometria & { id: number })[]; elementos: (Geometria & { id: number })[] },
  ) =>
    peticion<{ mesas: number; elementos: number; barras: number }>(conLayout('/salon/posiciones', layoutId), { method: 'PUT', ...json(lote) }),

  /* ── Menú ───────────────────────────────────────────────────────── */
  menu: (completo = false) => peticion<Categoria[]>(`/menu${completo ? '?completo=1' : ''}`),
  grupos: () => peticion<GrupoModificador[]>('/menu/grupos'),
  disponibilidad: (productoId: number, disponible: boolean) =>
    peticion<Producto>(`/menu/productos/${productoId}/disponibilidad`, { method: 'POST', ...json({ disponible }) }),
  reabrirDisponibilidad: () => peticion<{ reactivados: number }>('/menu/reabrir-disponibilidad', { method: 'POST' }),

  crearCategoria: (datos: { nombre: string; color?: string }) =>
    peticion<Categoria>('/menu/categorias', { method: 'POST', ...json(datos) }),
  actualizarCategoria: (id: number, cambios: { nombre?: string; color?: string; orden?: number; activa?: boolean }) =>
    peticion<Categoria>(`/menu/categorias/${id}`, { method: 'PATCH', ...json(cambios) }),
  eliminarCategoria: (id: number) => peticion<Categoria>(`/menu/categorias/${id}`, { method: 'DELETE' }),

  crearProducto: (datos: Record<string, unknown>) => peticion<Producto>('/menu/productos', { method: 'POST', ...json(datos) }),
  actualizarProducto: (id: number, cambios: Record<string, unknown>) =>
    peticion<Producto>(`/menu/productos/${id}`, { method: 'PATCH', ...json(cambios) }),
  eliminarProducto: (id: number) => peticion<Producto>(`/menu/productos/${id}`, { method: 'DELETE' }),

  agregarVariante: (productoId: number, datos: { nombre: string; precioCentavos: number }) =>
    peticion<unknown>(`/menu/productos/${productoId}/variantes`, { method: 'POST', ...json(datos) }),
  actualizarVariante: (id: number, cambios: { nombre?: string; precioCentavos?: number; activa?: boolean }) =>
    peticion<unknown>(`/menu/variantes/${id}`, { method: 'PATCH', ...json(cambios) }),
  eliminarVariante: (id: number) => peticion<unknown>(`/menu/variantes/${id}`, { method: 'DELETE' }),

  crearGrupo: (datos: { nombre: string; minSelecciones: number; maxSelecciones: number; modificadores: { nombre: string; precioExtraCentavos: number }[] }) =>
    peticion<GrupoModificador>('/menu/grupos', { method: 'POST', ...json(datos) }),
  actualizarGrupo: (
    id: number,
    cambios: { nombre?: string; minSelecciones?: number; maxSelecciones?: number; orden?: number },
  ) => peticion<GrupoModificador>(`/menu/grupos/${id}`, { method: 'PATCH', ...json(cambios) }),
  eliminarGrupo: (id: number) => peticion<unknown>(`/menu/grupos/${id}`, { method: 'DELETE' }),
  crearModificador: (datos: { grupoId: number; nombre: string; precioExtraCentavos: number }) =>
    peticion<unknown>('/menu/modificadores', { method: 'POST', ...json(datos) }),
  actualizarModificador: (
    id: number,
    cambios: { nombre?: string; precioExtraCentavos?: number; orden?: number; activo?: boolean },
  ) => peticion<unknown>(`/menu/modificadores/${id}`, { method: 'PATCH', ...json(cambios) }),
  eliminarModificador: (id: number) => peticion<unknown>(`/menu/modificadores/${id}`, { method: 'DELETE' }),

  /* ── Órdenes ────────────────────────────────────────────────────── */
  tablero: () => peticion<MesaTablero[]>('/ordenes/tablero'),
  pedirCuenta: (ordenId: number) => peticion<Orden>(`/ordenes/${ordenId}/pedir-cuenta`, { method: 'POST' }),
  marcarEntregado: (ordenId: number) => peticion<Orden>(`/ordenes/${ordenId}/entregar`, { method: 'POST' }),
  cancelarMesaVacia: (ordenId: number) =>
    peticion<{ ok: true }>(`/ordenes/${ordenId}/cancelar-vacia`, { method: 'POST' }),
  ordenDeMesa: (mesaId: number) => peticion<Orden | null>(`/ordenes/por-mesa/${mesaId}`),
  orden: (id: number) => peticion<Orden>(`/ordenes/${id}`),
  abrirOrden: (mesaId: number, comensales: number) =>
    peticion<Orden>('/ordenes', { method: 'POST', ...json({ mesaId, comensales }) }),
  agregarLineas: (
    ordenId: number,
    lineas: { varianteId: number; cantidadMilesimas: number; nota: string; modificadoresIds: number[]; precioCentavos?: number }[],
    cuentaId?: number,
  ) => peticion<Orden>(`/ordenes/${ordenId}/lineas`, { method: 'POST', ...json({ lineas, cuentaId }) }),
  actualizarLinea: (id: number, cambios: { cantidadMilesimas?: number; nota?: string }) =>
    peticion<unknown>(`/ordenes/lineas/${id}`, { method: 'PATCH', ...json(cambios) }),
  eliminarLinea: (id: number) => peticion<unknown>(`/ordenes/lineas/${id}`, { method: 'DELETE' }),
  cancelarLinea: (id: number, datos: { motivo: string; pinAutorizacion: string; esCortesia: boolean }) =>
    peticion<unknown>(`/ordenes/lineas/${id}/cancelar`, { method: 'POST', ...json(datos) }),
  enviarComanda: (ordenId: number, claveIdempotencia: string) =>
    peticion<{ comandas: Comanda[]; repetida: boolean; orden: Orden }>(`/ordenes/${ordenId}/enviar`, {
      method: 'POST',
      ...json({ claveIdempotencia }),
    }),
  transferirOrden: (ordenId: number, mesaDestinoId: number) =>
    peticion<unknown>(`/ordenes/${ordenId}/transferir`, { method: 'POST', ...json({ mesaDestinoId }) }),

  comandasPendientes: (estacion?: 'cocina' | 'barra') =>
    peticion<Comanda[]>(`/ordenes/comandas/pendientes${estacion ? `?estacion=${estacion}` : ''}`),
  comandaLista: (id: number) => peticion<unknown>(`/ordenes/comandas/${id}/lista`, { method: 'POST' }),

  /* ── Cuentas ────────────────────────────────────────────────────── */
  cuentas: (ordenId: number) => peticion<Cuenta[]>(`/ordenes/${ordenId}/cuentas`),
  crearCuenta: (ordenId: number, nombre?: string) =>
    peticion<Cuenta>(`/cuentas/orden/${ordenId}`, { method: 'POST', ...json({ nombre }) }),
  eliminarCuenta: (id: number) => peticion<unknown>(`/cuentas/${id}`, { method: 'DELETE' }),
  repartirLinea: (lineaId: number, cuentaIds: number[]) =>
    peticion<Cuenta[]>('/cuentas/repartir', { method: 'POST', ...json({ lineaId, cuentaIds }) }),
  asignarLinea: (cuentaId: number, lineaId: number, proporcionMilesimas = 1000) =>
    peticion<Cuenta[]>('/cuentas/asignar', { method: 'POST', ...json({ cuentaId, lineaId, proporcionMilesimas, exclusiva: true }) }),
  moverUnidades: (lineaIds: number[], cantidadMilesimas: number, cuentaDestinoId: number) =>
    peticion<Cuenta[]>('/cuentas/mover', { method: 'POST', ...json({ lineaIds, cantidadMilesimas, cuentaDestinoId }) }),
  dividirEnPartes: (ordenId: number, partes: number) =>
    peticion<Cuenta[]>(`/cuentas/orden/${ordenId}/dividir`, { method: 'POST', ...json({ partes }) }),
  aplicarDescuento: (cuentaId: number, datos: { tipo: 'monto' | 'porcentaje'; valor: number; motivo: string; pinAutorizacion: string }) =>
    peticion<Cuenta>(`/cuentas/${cuentaId}/descuento`, { method: 'POST', ...json(datos) }),
  establecerPropina: (cuentaId: number, propinaCentavos: number) =>
    peticion<Cuenta>(`/cuentas/${cuentaId}/propina`, { method: 'POST', ...json({ propinaCentavos }) }),
  cobrar: (
    cuentaId: number,
    pagos: { metodo: MetodoPago; montoCentavos: number; referencia: string; recibidoCentavos?: number }[],
    claveIdempotencia: string,
  ) => peticion<{ repetido: boolean; ordenCerrada?: boolean }>(`/cuentas/${cuentaId}/cobrar`, {
    method: 'POST',
    ...json({ pagos, claveIdempotencia }),
  }),
  reabrirCuenta: (cuentaId: number, datos: { motivo: string; pinAutorizacion: string }) =>
    peticion<unknown>(`/cuentas/${cuentaId}/reabrir`, { method: 'POST', ...json(datos) }),

  /* ── Caja ───────────────────────────────────────────────────────── */
  turnoActual: () => peticion<ResumenTurno | null>('/caja/turno-actual'),
  turnos: () => peticion<(Turno & { usuario: string })[]>('/caja/turnos'),
  abrirTurno: (fondoInicialCentavos: number) =>
    peticion<Turno>('/caja/turnos', { method: 'POST', ...json({ fondoInicialCentavos }) }),
  movimientoCaja: (datos: { tipo: 'entrada' | 'retiro' | 'gasto' | 'propina_pagada'; montoCentavos: number; concepto: string }) =>
    peticion<unknown>('/caja/movimientos', { method: 'POST', ...json(datos) }),
  cerrarTurno: (turnoId: number, declaradoCentavos: number) =>
    peticion<ResumenTurno>(`/caja/turnos/${turnoId}/cerrar`, { method: 'POST', ...json({ declaradoCentavos }) }),

  /* ── Reportes ───────────────────────────────────────────────────── */
  reporteVentas: (desde: string, hasta: string) =>
    peticion<Record<string, never> & { ventasCentavos: number; cuentas: number; ticketPromedioCentavos: number; propinasCentavos: number; descuentosCentavos: number; impuestosCentavos: number; porMetodo: { metodo: MetodoPago; total: number; operaciones: number }[] }>(
      `/reportes/ventas?desde=${desde}&hasta=${hasta}`,
    ),
  reporteProductos: (desde: string, hasta: string) =>
    peticion<{ producto: string; variante: string; cantidad: number; importeCentavos: number }[]>(
      `/reportes/productos?desde=${desde}&hasta=${hasta}`,
    ),
  reporteMeseros: (desde: string, hasta: string) =>
    peticion<{ mesero: string; cuentas: number; ventasCentavos: number; propinasCentavos: number }[]>(
      `/reportes/meseros?desde=${desde}&hasta=${hasta}`,
    ),
  reporteCancelaciones: (desde: string, hasta: string) =>
    peticion<{ id: number; producto: string; importeCentavos: number; motivo: string | null; esCortesia: boolean; autorizo: string | null; folio: number }[]>(
      `/reportes/cancelaciones?desde=${desde}&hasta=${hasta}`,
    ),

  /* ── Configuración ──────────────────────────────────────────────── */
  config: () => peticion<Config>('/config'),
  guardarConfig: (cambios: Config) => peticion<Config>('/config', { method: 'PUT', ...json(cambios) }),
};

/* ── Selección de implementación ────────────────────────────────────────
   GitHub Pages solo sirve archivos estáticos: ahí no hay servidor real, así
   que el build de demo (`npm run build:mock`) usa la API simulada en el
   navegador. El build normal (`npm run build`) sigue hablando con el
   servidor real: nada de esto afecta al sistema que usa el restaurante. */
import { apiSimulada } from './apiSimulada';

export const api = import.meta.env.VITE_MOCK === '1' ? apiSimulada : apiReal;
