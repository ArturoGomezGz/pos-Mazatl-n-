import path from 'node:path';

/** Configuración del servidor. Todo con valores por defecto útiles: el sistema
 *  debe arrancar en el mini-PC del restaurante sin que nadie configure nada. */
export const config = {
  puerto: Number(process.env.PORT ?? 3001),
  dbRuta: process.env.DB_RUTA ?? path.resolve(process.cwd(), 'data/pos.sqlite'),
  corsOrigen: process.env.CORS_ORIGEN ?? 'http://localhost:5173',
  entorno: process.env.NODE_ENV ?? 'development',
} as const;
