import { eq } from 'drizzle-orm';
import { db } from '../../db/cliente.js';
import { config } from '../../db/esquema.js';

/** Configuración del negocio. Incluye el **estilo del menú**: cómo se ve la
 *  pantalla de venta. Distintos restaurantes quieren cosas distintas y ninguno
 *  debería necesitar un programador para cambiarlo. */
export const VALORES_POR_DEFECTO = {
  negocio_nombre: 'Mariscos Mazatlán',
  negocio_direccion: '',
  negocio_telefono: '',
  ticket_pie: '¡Gracias por su visita!',

  impuesto_tasa: '16',            // porcentaje
  impuesto_incluido: '1',         // 1 = los precios ya incluyen impuesto (lo normal en México)
  propina_sugerida: '10,15,20',   // porcentajes que ofrece la pantalla de cobro

  // Estilo del menú en la pantalla de venta
  menu_vista: 'cuadricula',       // cuadricula | lista
  menu_columnas: '3',             // 2 | 3 | 4
  menu_mostrar_precios: '1',
  menu_mostrar_descripcion: '0',
  menu_color_por_categoria: '1',
  menu_tamano_boton: 'grande',    // comodo | grande
  menu_agotados: 'atenuar',       // atenuar | ocultar
} as const;

export type ClaveConfig = keyof typeof VALORES_POR_DEFECTO;

export function obtenerConfig(): Record<string, string> {
  const guardados = Object.fromEntries(db.select().from(config).all().map((f) => [f.clave, f.valor]));
  return { ...VALORES_POR_DEFECTO, ...guardados };
}

export function guardarConfig(cambios: Record<string, string>) {
  db.transaction((tx) => {
    for (const [clave, valor] of Object.entries(cambios)) {
      const existente = tx.select().from(config).where(eq(config.clave, clave)).get();
      if (existente) tx.update(config).set({ valor }).where(eq(config.clave, clave)).run();
      else tx.insert(config).values({ clave, valor }).run();
    }
  });
  return obtenerConfig();
}

/** Tasa de impuesto en centésimas de punto porcentual, para cálculos enteros. */
export function datosImpuesto() {
  const c = obtenerConfig();
  return {
    tasaPorMil: Math.round(Number(c.impuesto_tasa ?? 0) * 10),
    incluido: c.impuesto_incluido === '1',
  };
}
