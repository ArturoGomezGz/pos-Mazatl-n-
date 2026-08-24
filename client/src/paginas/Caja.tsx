import { useCallback, useEffect, useState } from 'react';
import { api, ErrorApi } from '../api/cliente';
import { Dialogo } from '../componentes/Dialogo';
import { TecladoNumerico } from '../componentes/TecladoNumerico';
import { ETIQUETAS_METODO, pesos, type ResumenTurno } from '../tipos';

export function Caja() {
  const [resumen, setResumen] = useState<ResumenTurno | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monto, setMonto] = useState('');
  const [cerrando, setCerrando] = useState(false);
  const [movimiento, setMovimiento] = useState<{ tipo: 'entrada' | 'retiro' | 'gasto' | 'propina_pagada'; concepto: string } | null>(null);
  const [corte, setCorte] = useState<ResumenTurno | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setResumen(await api.turnoActual());
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar la caja');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function accion(fn: () => Promise<void>) {
    try {
      await fn();
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'Ocurrió un error');
    }
  }

  const abrir = () =>
    accion(async () => {
      await api.abrirTurno(Number(monto || '0'));
      setMonto('');
      await cargar();
    });

  const cerrar = () =>
    accion(async () => {
      if (!resumen) return;
      const cerrado = await api.cerrarTurno(resumen.turno.id, Number(monto || '0'));
      setCorte(cerrado);
      setCerrando(false);
      setMonto('');
      await cargar();
    });

  const registrar = () =>
    accion(async () => {
      if (!movimiento) return;
      await api.movimientoCaja({ tipo: movimiento.tipo, montoCentavos: Number(monto || '0'), concepto: movimiento.concepto });
      setMovimiento(null);
      setMonto('');
      await cargar();
    });

  if (cargando) return <div className="cargando">Cargando la caja…</div>;

  if (!resumen) {
    return (
      <div className="contenido">
        <div className="panel-central">
          <h2>Abrir turno de caja</h2>
          <p className="detalle-dialogo">
            ¿Con cuánto dinero empieza la caja? Sin turno abierto no se puede cobrar: es lo que hace que el corte cuadre.
          </p>
          <div className="monto-grande">{pesos(Number(monto || '0'))}</div>
          <TecladoNumerico onTecla={(t) => setMonto((p) => (p + t).replace(/^0+/, '').slice(0, 8))} onBorrar={() => setMonto((p) => p.slice(0, -1))} />
          {error && <div className="aviso">{error}</div>}
          <button className="btn primario grande" onClick={abrir}>Abrir turno</button>
        </div>
      </div>
    );
  }

  return (
    <div className="contenido">
      <div className="barra">
        <strong>Turno abierto</strong>
        <span className="tenue">desde {resumen.turno.abiertoEn}</span>
        <span className="empuje" />
        <button className="btn chico" onClick={() => setMovimiento({ tipo: 'retiro', concepto: '' })}>Retiro</button>
        <button className="btn chico" onClick={() => setMovimiento({ tipo: 'gasto', concepto: '' })}>Gasto</button>
        <button className="btn chico" onClick={() => setMovimiento({ tipo: 'entrada', concepto: '' })}>Entrada</button>
        <button className="btn primario" onClick={() => { setCerrando(true); setMonto(''); }}>Hacer corte</button>
      </div>

      {error && <div className="aviso">{error}</div>}

      <div className="cuerpo bloques">
        <div className="tarjetas">
          <Tarjeta titulo="Ventas del turno" valor={pesos(resumen.ventasCentavos)} detalle={`${resumen.cuentasCobradas} cuenta(s)`} />
          <Tarjeta titulo="Efectivo esperado" valor={pesos(resumen.esperadoEfectivoCentavos)} detalle="lo que debe haber en el cajón" destacada />
          <Tarjeta titulo="Propinas" valor={pesos(resumen.propinasCentavos)} />
          <Tarjeta titulo="Descuentos" valor={pesos(resumen.descuentosCentavos)} />
          <Tarjeta titulo="Fondo inicial" valor={pesos(resumen.turno.fondoInicialCentavos)} />
          <Tarjeta titulo="Entradas / salidas" valor={`${pesos(resumen.entradasCentavos)} / ${pesos(resumen.salidasCentavos)}`} />
        </div>

        <section className="bloque">
          <h2>Cobrado por método</h2>
          <table className="tabla">
            <tbody>
              {resumen.porMetodo.map((m) => (
                <tr key={m.metodo}>
                  <td>{ETIQUETAS_METODO[m.metodo]}</td>
                  <td className="numero">{m.operaciones}</td>
                  <td className="numero">{pesos(m.total)}</td>
                </tr>
              ))}
              {resumen.porMetodo.length === 0 && <tr><td colSpan={3} className="tenue">Todavía no hay cobros.</td></tr>}
            </tbody>
          </table>
        </section>

        <section className="bloque">
          <h2>Movimientos de efectivo</h2>
          <table className="tabla">
            <tbody>
              {resumen.movimientos.map((m) => (
                <tr key={m.id}>
                  <td>{m.tipo}</td>
                  <td>{m.concepto}</td>
                  <td className="numero">{pesos(m.montoCentavos)}</td>
                </tr>
              ))}
              {resumen.movimientos.length === 0 && <tr><td colSpan={3} className="tenue">Sin movimientos.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>

      {movimiento && (
        <Dialogo titulo={`Registrar ${movimiento.tipo}`} onCerrar={() => setMovimiento(null)} ancho={420}>
          <div className="campo">
            <label htmlFor="concepto">Concepto</label>
            <input
              id="concepto"
              value={movimiento.concepto}
              placeholder="Ej. compra de hielo"
              onChange={(e) => setMovimiento({ ...movimiento, concepto: e.target.value })}
            />
          </div>
          <div className="monto-grande">{pesos(Number(monto || '0'))}</div>
          <TecladoNumerico onTecla={(t) => setMonto((p) => (p + t).replace(/^0+/, '').slice(0, 8))} onBorrar={() => setMonto((p) => p.slice(0, -1))} />
          <div className="acciones-dialogo">
            <button className="btn" onClick={() => setMovimiento(null)}>Cancelar</button>
            <button className="btn primario" disabled={!movimiento.concepto.trim() || !monto} onClick={registrar}>
              Registrar
            </button>
          </div>
        </Dialogo>
      )}

      {cerrando && (
        <Dialogo titulo="Corte de caja" onCerrar={() => setCerrando(false)} ancho={460}>
          <p className="detalle-dialogo">
            Cuenta el efectivo del cajón y captura el total. El sistema espera <b>{pesos(resumen.esperadoEfectivoCentavos)}</b>.
            La diferencia se guarda tal cual: el corte sirve para saber la verdad, no para que cuadre.
          </p>
          <div className="monto-grande">
            {pesos(Number(monto || '0'))}
            <span className="cambio">Diferencia {pesos(Number(monto || '0') - resumen.esperadoEfectivoCentavos)}</span>
          </div>
          <TecladoNumerico onTecla={(t) => setMonto((p) => (p + t).replace(/^0+/, '').slice(0, 8))} onBorrar={() => setMonto((p) => p.slice(0, -1))} />
          <div className="acciones-dialogo">
            <button className="btn" onClick={() => setCerrando(false)}>Cancelar</button>
            <button className="btn primario" onClick={cerrar}>Cerrar turno</button>
          </div>
        </Dialogo>
      )}

      {corte && (
        <Dialogo titulo="Turno cerrado" onCerrar={() => setCorte(null)} ancho={460}>
          <div className="totales">
            <div><span>Ventas</span><span>{pesos(corte.ventasCentavos)}</span></div>
            <div><span>Efectivo esperado</span><span>{pesos(corte.esperadoEfectivoCentavos)}</span></div>
            <div><span>Efectivo contado</span><span>{pesos(corte.turno.declaradoCentavos ?? 0)}</span></div>
            <div className="gran-total">
              <span>Diferencia</span>
              <span>{pesos(corte.diferenciaCentavos ?? 0)}</span>
            </div>
          </div>
          <div className="acciones-dialogo">
            <button className="btn" onClick={() => window.print()}>Imprimir corte</button>
            <button className="btn primario" onClick={() => setCorte(null)}>Listo</button>
          </div>
        </Dialogo>
      )}
    </div>
  );
}

function Tarjeta({ titulo, valor, detalle, destacada }: { titulo: string; valor: string; detalle?: string; destacada?: boolean }) {
  return (
    <div className={`tarjeta${destacada ? ' destacada' : ''}`}>
      <span className="tarjeta-titulo">{titulo}</span>
      <strong className="tarjeta-valor">{valor}</strong>
      {detalle && <span className="tarjeta-detalle">{detalle}</span>}
    </div>
  );
}
