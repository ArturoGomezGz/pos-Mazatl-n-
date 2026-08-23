import type { Elemento, Layout, Mesa, Plano, Zona } from '../tipos';

export class ErrorApi extends Error {
  constructor(message: string, public readonly estado: number, public readonly detalle?: unknown) {
    super(message);
    this.name = 'ErrorApi';
  }
}

async function peticion<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`/api${ruta}`, {
      ...opciones,
      headers: { 'content-type': 'application/json', ...opciones.headers },
    });
  } catch {
    // En el restaurante esto casi siempre es el Wi-Fi, no un bug: dilo así.
    throw new ErrorApi('No hay conexión con el servidor del restaurante', 0);
  }

  if (respuesta.status === 204) return undefined as T;

  const cuerpo = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    const mensaje = (cuerpo && typeof cuerpo === 'object' && 'error' in cuerpo && String(cuerpo.error)) || 'Error inesperado';
    throw new ErrorApi(mensaje, respuesta.status, cuerpo && (cuerpo as { detalle?: unknown }).detalle);
  }
  return cuerpo as T;
}

const conLayout = (ruta: string, layoutId?: number) => (layoutId ? `${ruta}?layout=${layoutId}` : ruta);

export const api = {
  plano: (layoutId?: number) => peticion<Plano>(conLayout('/salon/plano', layoutId)),

  crearLayout: (nombre: string, copiarDeId?: number) =>
    peticion<Layout>('/salon/layouts', { method: 'POST', body: JSON.stringify({ nombre, copiarDeId }) }),
  activarLayout: (id: number) =>
    peticion<Layout>(`/salon/layouts/${id}`, { method: 'PATCH', body: JSON.stringify({ activo: true }) }),
  renombrarLayout: (id: number, nombre: string) =>
    peticion<Layout>(`/salon/layouts/${id}`, { method: 'PATCH', body: JSON.stringify({ nombre }) }),
  eliminarLayout: (id: number) => peticion<Layout>(`/salon/layouts/${id}`, { method: 'DELETE' }),

  crearZona: (datos: { nombre: string; ancho?: number; alto?: number }) =>
    peticion<Zona>('/salon/zonas', { method: 'POST', body: JSON.stringify(datos) }),
  actualizarZona: (id: number, cambios: Partial<Pick<Zona, 'nombre' | 'ancho' | 'alto' | 'orden' | 'activa'>>) =>
    peticion<Zona>(`/salon/zonas/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) }),
  eliminarZona: (id: number) => peticion<Zona>(`/salon/zonas/${id}`, { method: 'DELETE' }),

  crearMesa: (datos: Partial<Mesa> & { zonaId: number; nombre: string }, layoutId?: number) =>
    peticion<Mesa>(conLayout('/salon/mesas', layoutId), { method: 'POST', body: JSON.stringify(datos) }),
  actualizarMesa: (id: number, cambios: Partial<Mesa>, layoutId?: number) =>
    peticion<Mesa>(conLayout(`/salon/mesas/${id}`, layoutId), { method: 'PATCH', body: JSON.stringify(cambios) }),
  eliminarMesa: (id: number) => peticion<Mesa>(`/salon/mesas/${id}`, { method: 'DELETE' }),

  crearElemento: (datos: Partial<Elemento> & { zonaId: number }, layoutId?: number) =>
    peticion<Elemento>(conLayout('/salon/elementos', layoutId), { method: 'POST', body: JSON.stringify(datos) }),
  actualizarElemento: (id: number, cambios: Partial<Elemento>) =>
    peticion<Elemento>(`/salon/elementos/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) }),
  eliminarElemento: (id: number) => peticion<Elemento>(`/salon/elementos/${id}`, { method: 'DELETE' }),

  guardarPosiciones: (
    layoutId: number,
    lote: { mesas: (Geometria & { id: number })[]; elementos: (Geometria & { id: number })[] },
  ) => peticion<{ mesas: number; elementos: number }>(conLayout('/salon/posiciones', layoutId), {
    method: 'PUT',
    body: JSON.stringify(lote),
  }),
};

type Geometria = { x: number; y: number; ancho: number; alto: number; rotacion: number };
