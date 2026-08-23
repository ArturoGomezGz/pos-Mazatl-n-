/** Error de la capa de datos, sea el servidor real o la API simulada del modo
 *  demo. Vive aparte para que ninguna de las dos implementaciones dependa
 *  de la otra. */
export class ErrorApi extends Error {
  constructor(message: string, public readonly estado: number, public readonly detalle?: unknown) {
    super(message);
    this.name = 'ErrorApi';
  }
}
