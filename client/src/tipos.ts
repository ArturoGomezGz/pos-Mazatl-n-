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
