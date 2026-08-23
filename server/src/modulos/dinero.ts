/** Todo el dinero del sistema vive aquí, en centavos y aritmética entera.
 *  Ninguna cantidad monetaria se calcula con punto flotante. */

/** Total de una línea: (precio unitario + extras) × cantidad. */
export function totalLinea(precioUnitarioCentavos: number, extrasCentavos: number, cantidadMilesimas: number): number {
  return Math.round(((precioUnitarioCentavos + extrasCentavos) * cantidadMilesimas) / 1000);
}

/** Reparte un importe entre varias partes proporcionalmente, **sin perder centavos**:
 *  los que sobran por redondeo se asignan a las primeras partes (mayor resto primero). */
export function repartir(importeCentavos: number, pesos: number[]): number[] {
  const suma = pesos.reduce((a, b) => a + b, 0);
  if (suma <= 0) return pesos.map(() => 0);

  const exactos = pesos.map((p) => (importeCentavos * p) / suma);
  const base = exactos.map((v) => Math.floor(v));
  let restante = importeCentavos - base.reduce((a, b) => a + b, 0);

  const porResto = exactos
    .map((v, i) => ({ i, resto: v - Math.floor(v) }))
    .sort((a, b) => b.resto - a.resto || a.i - b.i);

  for (const { i } of porResto) {
    if (restante <= 0) break;
    base[i] = (base[i] ?? 0) + 1;
    restante--;
  }
  return base;
}

/** Impuesto de una base gravable.
 *  - incluido: el precio ya lo trae; se desglosa para el ticket, no se suma.
 *  - no incluido: se calcula y se suma al total. */
export function calcularImpuesto(baseCentavos: number, tasaPorMil: number, incluido: boolean) {
  if (tasaPorMil <= 0) return { impuesto: 0, sumaAlTotal: 0 };
  if (incluido) {
    const sinImpuesto = Math.round((baseCentavos * 1000) / (1000 + tasaPorMil));
    return { impuesto: baseCentavos - sinImpuesto, sumaAlTotal: 0 };
  }
  const impuesto = Math.round((baseCentavos * tasaPorMil) / 1000);
  return { impuesto, sumaAlTotal: impuesto };
}

export const pesos = (centavos: number) =>
  (centavos / 100).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
