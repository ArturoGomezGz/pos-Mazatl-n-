import { useCallback, useEffect, useState } from 'react';
import { api, ErrorApi } from '../api/cliente';
import { ETIQUETAS_METODO, pesos, type MetodoPago } from '../tipos';

const hoy = () => new Date().toISOString().slice(0, 10);

export function Reportes() {
  const [desde, setDesde] = useState(hoy());
  const [hasta, setHasta] = useState(hoy());
  const [ventas, setVentas] = useState<{ ventasCentavos: number; cuentas: number; ticketPromedioCentavos: number; propinasCentavos: number; descuentosCentavos: number; impuestosCentavos: number; porMetodo: { metodo: MetodoPago; total: number; operaciones: number }[] } | null>(null);
  const [productos, setProductos] = useState<{ producto: string; variante: string; cantidad: number; importeCentavos: number }[]>([]);
  const [meseros, setMeseros] = useState<{ mesero: string; cuentas: number; ventasCentavos: number; propinasCentavos: number }[]>([]);
  const [cancelaciones, setCancelaciones] = useState<{ id: number; producto: string; importeCentavos: number; motivo: string | null; esCortesia: boolean; autorizo: string | null; folio: number }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [v, p, m, c] = await Promise.all([
        api.reporteVentas(desde, hasta),
        api.reporteProductos(desde, hasta),
        api.reporteMeseros(desde, hasta),
        api.reporteCancelaciones(desde, hasta),
      ]);
      setVentas(v);
      setProductos(p);
      setMeseros(m);
      setCancelaciones(c);
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudieron cargar los reportes');
    }
  }, [desde, hasta]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const exportar = () => {
    const filas = [
      ['Producto', 'Tamaño', 'Cantidad', 'Importe'],
      ...productos.map((p) => [p.producto, p.variante, String(p.cantidad), (p.importeCentavos / 100).toFixed(2)]),
    ];
    const csv = filas.map((f) => f.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    enlace.download = `productos-${desde}-a-${hasta}.csv`;
    enlace.click();
  };

  return (
    <div className="contenido">
      <div className="barra">
        <strong>Reportes</strong>
        <label>Desde <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
        <label>Hasta <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
        <span className="empuje" />
        <button className="btn chico" onClick={exportar}>Exportar productos (CSV)</button>
      </div>

      {error && <div className="aviso">{error}</div>}

      {ventas && (
        <div className="tarjetas">
          <Tarjeta titulo="Venta" valor={pesos(ventas.ventasCentavos)} destacada />
          <Tarjeta titulo="Cuentas" valor={String(ventas.cuentas ?? 0)} />
          <Tarjeta titulo="Ticket promedio" valor={pesos(ventas.ticketPromedioCentavos)} />
          <Tarjeta titulo="Propinas" valor={pesos(ventas.propinasCentavos)} />
          <Tarjeta titulo="Descuentos" valor={pesos(ventas.descuentosCentavos)} />
          <Tarjeta titulo="IVA" valor={pesos(ventas.impuestosCentavos)} />
        </div>
      )}

      <div className="cuerpo bloques">
        <section className="bloque">
          <h2>Más vendidos</h2>
          <table className="tabla">
            <thead><tr><th>Producto</th><th className="numero">Cantidad</th><th className="numero">Importe</th></tr></thead>
            <tbody>
              {productos.map((p, i) => (
                <tr key={i}>
                  <td>{p.producto}{p.variante && <span className="tenue"> · {p.variante}</span>}</td>
                  <td className="numero">{p.cantidad}</td>
                  <td className="numero">{pesos(p.importeCentavos)}</td>
                </tr>
              ))}
              {productos.length === 0 && <tr><td colSpan={3} className="tenue">Sin ventas en el periodo.</td></tr>}
            </tbody>
          </table>
        </section>

        <section className="bloque">
          <h2>Cobrado por método</h2>
          <table className="tabla">
            <thead><tr><th>Método</th><th className="numero">Operaciones</th><th className="numero">Importe</th></tr></thead>
            <tbody>
              {(ventas?.porMetodo ?? []).map((m) => (
                <tr key={m.metodo}>
                  <td>{ETIQUETAS_METODO[m.metodo]}</td>
                  <td className="numero">{m.operaciones}</td>
                  <td className="numero">{pesos(m.total)}</td>
                </tr>
              ))}
              {(ventas?.porMetodo ?? []).length === 0 && <tr><td colSpan={3} className="tenue">Sin cobros en el periodo.</td></tr>}
            </tbody>
          </table>
        </section>

        <section className="bloque">
          <h2>Por mesero</h2>
          <table className="tabla">
            <thead><tr><th>Mesero</th><th className="numero">Cuentas</th><th className="numero">Venta</th><th className="numero">Propinas</th></tr></thead>
            <tbody>
              {meseros.map((m) => (
                <tr key={m.mesero}>
                  <td>{m.mesero}</td>
                  <td className="numero">{m.cuentas}</td>
                  <td className="numero">{pesos(m.ventasCentavos)}</td>
                  <td className="numero">{pesos(m.propinasCentavos)}</td>
                </tr>
              ))}
              {meseros.length === 0 && <tr><td colSpan={4} className="tenue">Sin ventas en el periodo.</td></tr>}
            </tbody>
          </table>
        </section>

        <section className="bloque">
          <h2>Cancelaciones y cortesías</h2>
          <table className="tabla">
            <thead><tr><th>Folio</th><th>Producto</th><th>Motivo</th><th>Autorizó</th><th className="numero">Importe</th></tr></thead>
            <tbody>
              {cancelaciones.map((c) => (
                <tr key={c.id}>
                  <td>{c.folio}</td>
                  <td>{c.producto}{c.esCortesia && <span className="tenue"> · cortesía</span>}</td>
                  <td>{c.motivo ?? '—'}</td>
                  <td>{c.autorizo ?? '—'}</td>
                  <td className="numero">{pesos(c.importeCentavos)}</td>
                </tr>
              ))}
              {cancelaciones.length === 0 && <tr><td colSpan={5} className="tenue">Ninguna. Buena señal.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function Tarjeta({ titulo, valor, destacada }: { titulo: string; valor: string; destacada?: boolean }) {
  return (
    <div className={`tarjeta${destacada ? ' destacada' : ''}`}>
      <span className="tarjeta-titulo">{titulo}</span>
      <strong className="tarjeta-valor">{valor}</strong>
    </div>
  );
}
