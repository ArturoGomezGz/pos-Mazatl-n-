import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ErrorApi, nuevaClave } from '../api/cliente';
import { Dialogo } from '../componentes/Dialogo';
import { PedirAutorizacion } from '../componentes/PedirAutorizacion';
import { TecladoNumerico } from '../componentes/TecladoNumerico';
import { useSesion } from '../estado/Sesion';
import {
  cantidadLegible,
  ETIQUETAS_METODO,
  pesos,
  type Cuenta,
  type MetodoPago,
  type Orden,
} from '../tipos';

interface PagoBorrador {
  metodo: MetodoPago;
  montoCentavos: number;
  referencia: string;
  recibidoCentavos?: number;
}

export function Cobro() {
  const { ordenId } = useParams();
  const navegar = useNavigate();
  const { config, puede } = useSesion();
  const id = Number(ordenId);

  const [orden, setOrden] = useState<Orden | null>(null);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [cuentaId, setCuentaId] = useState<number | null>(null);
  const [pagos, setPagos] = useState<PagoBorrador[]>([]);
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [recibido, setRecibido] = useState('');
  const [moviendo, setMoviendo] = useState<number | null>(null);
  const [descuentoBorrador, setDescuentoBorrador] = useState<{ tipo: 'monto' | 'porcentaje'; valor: number } | null>(null);
  const [pidiendoDescuento, setPidiendoDescuento] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cobrando, setCobrando] = useState(false);

  const cargar = useCallback(async () => {
    const [o, c] = await Promise.all([api.orden(id), api.cuentas(id)]);
    setOrden(o);
    setCuentas(c);
    setCuentaId((previo) => previo ?? c.find((x) => x.estado === 'abierta')?.id ?? c[0]?.id ?? null);
  }, [id]);

  useEffect(() => {
    cargar().catch((e) => setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar la cuenta'));
  }, [cargar]);

  async function accion(fn: () => Promise<void>) {
    try {
      await fn();
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'Ocurrió un error');
    }
  }

  const cuenta = cuentas.find((c) => c.id === cuentaId);
  const pagado = pagos.reduce((a, p) => a + p.montoCentavos, 0);
  const restante = Math.max(0, (cuenta?.totalCentavos ?? 0) - pagado);
  const recibidoCentavos = Number(recibido || '0');
  const cambio = Math.max(0, recibidoCentavos - restante);
  const sugeridas = (config.propina_sugerida ?? '10,15,20').split(',').map((n) => Number(n.trim())).filter(Boolean);
  // Si el cajero tecleó lo recibido, tiene que alcanzar: registrar un efectivo
  // menor al cobro deja la caja cuadrando mal desde el primer minuto.
  const efectivoInsuficiente = metodo === 'efectivo' && recibidoCentavos > 0 && recibidoCentavos < restante;

  const dividir = (partes: number) =>
    accion(async () => {
      const nuevas = await api.dividirEnPartes(id, partes);
      setCuentas(nuevas);
      setCuentaId(nuevas[0]?.id ?? null);
      setPagos([]);
    });

  const propina = (porcentaje: number) =>
    accion(async () => {
      if (!cuenta) return;
      const base = cuenta.subtotalCentavos - cuenta.descuentoCentavos;
      await api.establecerPropina(cuenta.id, Math.round((base * porcentaje) / 100));
      await cargar();
      setPagos([]);
    });

  const moverLinea = (lineaId: number, destinoId: number) =>
    accion(async () => {
      setCuentas(await api.asignarLinea(destinoId, lineaId));
      setMoviendo(null);
      setPagos([]);
    });

  const aplicarDescuento = (datos: { pin: string; motivo: string }) =>
    accion(async () => {
      if (!cuenta || !descuentoBorrador) return;
      await api.aplicarDescuento(cuenta.id, {
        tipo: descuentoBorrador.tipo,
        valor: descuentoBorrador.valor,
        motivo: datos.motivo,
        pinAutorizacion: datos.pin,
      });
      setDescuentoBorrador(null);
      setPidiendoDescuento(false);
      await cargar();
      setPagos([]);
    });

  const agregarPago = () => {
    if (restante <= 0) return;
    setPagos((previo) => [
      ...previo,
      {
        metodo,
        montoCentavos: restante,
        referencia: '',
        ...(metodo === 'efectivo' && recibidoCentavos > 0 ? { recibidoCentavos } : {}),
      },
    ]);
    setRecibido('');
  };

  const cobrar = () =>
    accion(async () => {
      if (!cuenta) return;
      const finales: PagoBorrador[] =
        pagos.length > 0
          ? pagos
          : [{
              metodo,
              montoCentavos: cuenta.totalCentavos,
              referencia: '',
              ...(metodo === 'efectivo' && recibidoCentavos > 0 ? { recibidoCentavos } : {}),
            }];

      setCobrando(true);
      try {
        // Clave única: si la red hace reintentar, no se cobra dos veces.
        const r = await api.cobrar(cuenta.id, finales, nuevaClave());
        setPagos([]);
        setRecibido('');
        await cargar();
        if (r.ordenCerrada) navegar('/salon');
      } finally {
        setCobrando(false);
      }
    });

  if (!orden || !cuenta) return <div className="cargando">Cargando la cuenta…</div>;

  const abiertas = cuentas.filter((c) => c.estado === 'abierta');

  return (
    <div className="contenido">
      <div className="barra">
        <button className="btn chico" onClick={() => navegar(`/orden/${orden.mesaId}`)}>◀ Orden</button>
        <strong>Mesa {orden.mesaNombre}</strong>
        <span className="tenue">folio {orden.folio} · {orden.meseroNombre}</span>
        <span className="empuje" />
        <button className="btn chico" onClick={() => accion(async () => { await api.crearCuenta(id); await cargar(); })}>
          + Cuenta
        </button>
        <button className="btn chico" onClick={() => dividir(Math.max(2, orden.comensales))}>
          Dividir entre {Math.max(2, orden.comensales)}
        </button>
        <button className="btn chico" onClick={() => window.print()}>Imprimir precuenta</button>
      </div>

      {cuentas.length > 1 && (
        <div className="pestanas">
          {cuentas.map((c) => (
            <button
              key={c.id}
              className={`pestana${c.id === cuentaId ? ' activa' : ''}`}
              onClick={() => { setCuentaId(c.id); setPagos([]); }}
            >
              {c.nombre} · {pesos(c.totalCentavos)}
              {c.estado === 'cobrada' && ' ✓'}
            </button>
          ))}
        </div>
      )}

      {error && <div className="aviso">{error}</div>}

      <div className="cuerpo">
        <div className="columna-cuenta">
          <div className="ticket">
            <h2>{cuenta.nombre}</h2>
            {cuenta.lineas.length === 0 && <p className="tenue">Sin consumo asignado.</p>}
            {cuenta.lineas.map((l) => (
              <div key={l.id} className="linea">
                <div className="linea-datos">
                  <span className="linea-cantidad">
                    {cantidadLegible(l.cantidadMilesimas, l.unidad)}
                    {l.proporcionMilesimas < 1000 && ` (${Math.round(l.proporcionMilesimas / 10)}%)`}
                  </span>
                  <span className="linea-nombre">
                    {l.productoNombre}
                    {l.varianteNombre && <em> · {l.varianteNombre}</em>}
                    {l.esCortesia && <small className="nota">cortesía</small>}
                  </span>
                  <span className="linea-importe">
                    {pesos(Math.round((l.totalCentavos * l.proporcionMilesimas) / 1000))}
                  </span>
                </div>
                {cuenta.estado === 'abierta' && cuentas.length > 1 && (
                  <button className="btn chico fantasma" onClick={() => setMoviendo(l.id)}>Mover</button>
                )}
              </div>
            ))}

            <div className="totales">
              <div><span>Subtotal</span><span>{pesos(cuenta.subtotalCentavos)}</span></div>
              {cuenta.descuentoCentavos > 0 && (
                <div className="descuento">
                  <span>Descuento · {cuenta.motivoDescuento}</span>
                  <span>−{pesos(cuenta.descuentoCentavos)}</span>
                </div>
              )}
              {cuenta.impuestoCentavos > 0 && (
                <div className="tenue">
                  <span>IVA {config.impuesto_incluido === '1' ? 'incluido' : ''}</span>
                  <span>{pesos(cuenta.impuestoCentavos)}</span>
                </div>
              )}
              {cuenta.propinaCentavos > 0 && (
                <div><span>Propina</span><span>{pesos(cuenta.propinaCentavos)}</span></div>
              )}
              <div className="gran-total"><span>Total</span><span>{pesos(cuenta.totalCentavos)}</span></div>
            </div>
          </div>
        </div>

        <aside className="panel derecho cobro">
          {cuenta.estado === 'cobrada' ? (
            <>
              <h2>Cuenta cobrada</h2>
              {cuenta.pagos.map((p) => (
                <p key={p.id}>
                  {ETIQUETAS_METODO[p.metodo]}: {pesos(p.montoCentavos)}
                  {p.cambioCentavos ? ` · cambio ${pesos(p.cambioCentavos)}` : ''}
                </p>
              ))}
              <button className="btn" onClick={() => window.print()}>Imprimir ticket</button>
            </>
          ) : (
            <>
              <h2>Cobrar</h2>

              <div className="grupo-opciones">
                <h3>Propina</h3>
                <div className="opciones">
                  {sugeridas.map((p) => (
                    <button key={p} className="opcion" onClick={() => propina(p)}>{p}%</button>
                  ))}
                  <button className="opcion" onClick={() => propina(0)}>Sin propina</button>
                </div>
              </div>

              <div className="grupo-opciones">
                <h3>Método</h3>
                <div className="opciones">
                  {(Object.keys(ETIQUETAS_METODO) as MetodoPago[]).map((m) => (
                    <button
                      key={m}
                      className={`opcion${metodo === m ? ' elegida' : ''}`}
                      onClick={() => setMetodo(m)}
                    >
                      {ETIQUETAS_METODO[m]}
                    </button>
                  ))}
                </div>
              </div>

              {metodo === 'efectivo' && (
                <>
                  <div className="monto-grande">
                    Recibido {pesos(recibidoCentavos)}
                    <span className="cambio">
                      {efectivoInsuficiente ? `Faltan ${pesos(restante - recibidoCentavos)}` : `Cambio ${pesos(cambio)}`}
                    </span>
                  </div>
                  <div className="opciones billetes">
                    {[20000, 50000, 100000].map((b) => (
                      <button key={b} className="opcion" onClick={() => setRecibido(String(b))}>{pesos(b)}</button>
                    ))}
                    <button className="opcion" onClick={() => setRecibido(String(restante))}>Exacto</button>
                  </div>
                  <TecladoNumerico
                    onTecla={(t) => setRecibido((p) => (p + t).replace(/^0+/, '').slice(0, 8))}
                    onBorrar={() => setRecibido((p) => p.slice(0, -1))}
                  />
                </>
              )}

              {pagos.length > 0 && (
                <div className="grupo-opciones">
                  <h3>Pagos registrados</h3>
                  {pagos.map((p, i) => (
                    <div key={i} className="linea">
                      <span>{ETIQUETAS_METODO[p.metodo]}</span>
                      <span>{pesos(p.montoCentavos)}</span>
                      <button className="btn chico fantasma" onClick={() => setPagos((v) => v.filter((_, j) => j !== i))}>
                        Quitar
                      </button>
                    </div>
                  ))}
                  <p className="tenue">Falta {pesos(restante)}</p>
                </div>
              )}

              <button className="btn" onClick={agregarPago} disabled={restante <= 0 || efectivoInsuficiente}>
                Pago parcial (mixto)
              </button>

              {puede('admin', 'cajero') && (
                <button className="btn" onClick={() => setDescuentoBorrador({ tipo: 'porcentaje', valor: 10 })}>
                  Aplicar descuento
                </button>
              )}

              <button
                className="btn primario grande"
                disabled={cobrando || efectivoInsuficiente || (pagos.length > 0 && restante > 0)}
                onClick={cobrar}
              >
                {cobrando ? 'Cobrando…' : `Cobrar ${pesos(cuenta.totalCentavos)}`}
              </button>

              {abiertas.length > 1 && (
                <p className="tenue">Quedan {abiertas.length - 1} cuenta(s) por cobrar en esta mesa.</p>
              )}
            </>
          )}
        </aside>
      </div>

      {moviendo !== null && (
        <Dialogo titulo="Mover a otra cuenta" onCerrar={() => setMoviendo(null)} ancho={380}>
          <div className="opciones">
            {abiertas.map((c) => (
              <button key={c.id} className="opcion" onClick={() => moverLinea(moviendo, c.id)}>
                {c.nombre}
              </button>
            ))}
          </div>
        </Dialogo>
      )}

      {descuentoBorrador && !pidiendoDescuento && (
        <Dialogo titulo="Descuento" onCerrar={() => setDescuentoBorrador(null)} ancho={420}>
          <div className="opciones">
            {[10, 15, 20, 50].map((p) => (
              <button
                key={p}
                className={`opcion${descuentoBorrador.tipo === 'porcentaje' && descuentoBorrador.valor === p ? ' elegida' : ''}`}
                onClick={() => setDescuentoBorrador({ tipo: 'porcentaje', valor: p })}
              >
                {p}%
              </button>
            ))}
          </div>
          <div className="campo">
            <label htmlFor="descuento-monto">…o un monto fijo en pesos</label>
            <input
              id="descuento-monto"
              type="number"
              min={0}
              placeholder="0"
              onChange={(e) => setDescuentoBorrador({ tipo: 'monto', valor: Math.round(Number(e.target.value) * 100) })}
            />
          </div>
          <div className="acciones-dialogo">
            <button className="btn" onClick={() => setDescuentoBorrador(null)}>Cancelar</button>
            <button className="btn primario" onClick={() => setPidiendoDescuento(true)}>Continuar</button>
          </div>
        </Dialogo>
      )}

      {pidiendoDescuento && descuentoBorrador && (
        <PedirAutorizacion
          titulo="Autorizar descuento"
          detalle={
            descuentoBorrador.tipo === 'porcentaje'
              ? `Descuento de ${descuentoBorrador.valor}% sobre ${pesos(cuenta.subtotalCentavos)}`
              : `Descuento de ${pesos(descuentoBorrador.valor)}`
          }
          onCancelar={() => setPidiendoDescuento(false)}
          onConfirmar={aplicarDescuento}
        />
      )}
    </div>
  );
}
