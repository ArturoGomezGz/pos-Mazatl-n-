import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ErrorApi, nuevaClave } from '../api/cliente';
import { Dialogo } from '../componentes/Dialogo';
import { PedirAutorizacion } from '../componentes/PedirAutorizacion';
import { TecladoNumerico } from '../componentes/TecladoNumerico';
import { useSesion } from '../estado/Sesion';
import { cantidadLegible, ETIQUETAS_METODO, pesos, type Cuenta, type MetodoPago, type Orden } from '../tipos';

interface PagoBorrador {
  metodo: MetodoPago;
  montoCentavos: number;
  referencia: string;
  recibidoCentavos?: number;
}

type Separacion = null | 'menu' | 'iguales' | 'porPlatillo' | 'repartir';

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
  const [mostrarCobro, setMostrarCobro] = useState(false);
  const [separando, setSeparando] = useState<Separacion>(null);
  const [partes, setPartes] = useState(2);
  const [pasando, setPasando] = useState<GrupoLinea | null>(null);
  const [repartiendo, setRepartiendo] = useState<GrupoLinea | null>(null);
  const [descuentoBorrador, setDescuentoBorrador] = useState<{ tipo: 'monto' | 'porcentaje'; valor: number } | null>(null);
  const [pidiendoDescuento, setPidiendoDescuento] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cobrando, setCobrando] = useState(false);

  const cargar = useCallback(async () => {
    const [o, c] = await Promise.all([api.orden(id), api.cuentas(id)]);
    setOrden(o);
    setCuentas(c);
    setCuentaId((previo) => (previo && c.some((x) => x.id === previo) ? previo : c.find((x) => x.estado === 'abierta')?.id ?? c[0]?.id ?? null));
  }, [id]);

  useEffect(() => {
    cargar().catch((e) => setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar la cuenta'));
  }, [cargar]);

  useEffect(() => {
    if (orden) setPartes(Math.max(2, orden.comensales));
  }, [orden]);

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
  const baseDePropina = (cuenta?.subtotalCentavos ?? 0) - (cuenta?.descuentoCentavos ?? 0);
  const efectivoInsuficiente = metodo === 'efectivo' && recibidoCentavos > 0 && recibidoCentavos < restante;
  const abiertas = cuentas.filter((c) => c.estado === 'abierta');
  const separada = cuentas.length > 1;
  // Solo dividirEnPartesIguales deja a todas las cuentas abiertas con exactamente
  // el mismo consumo: es la única forma confiable de saber que estamos en ese modo
  // sin agregar un campo nuevo en la base de datos.
  const modoIgual =
    separada &&
    abiertas.length > 1 &&
    (abiertas[0]?.lineas.length ?? 0) > 0 &&
    abiertas.every((c) => {
      const ref = new Set(abiertas[0]!.lineas.map((l) => l.id));
      const propios = new Set(c.lineas.map((l) => l.id));
      return propios.size === ref.size && [...propios].every((idLinea) => ref.has(idLinea));
    });

  const dividirIgual = (n: number) =>
    accion(async () => {
      const nuevas = await api.dividirEnPartes(id, n);
      setCuentas(nuevas);
      setCuentaId(nuevas[0]?.id ?? null);
      setPagos([]);
      setSeparando(null);
    });

  const crearCuentasVacias = (n: number) =>
    accion(async () => {
      for (let i = cuentas.length; i < n; i++) await api.crearCuenta(id);
      await cargar();
      setSeparando(null);
    });

  const moverGrupo = (lineaIds: number[], cantidadMilesimas: number, destinoId: number) =>
    accion(async () => {
      setCuentas(await api.moverUnidades(lineaIds, cantidadMilesimas, destinoId));
      setPasando(null);
      setPagos([]);
    });

  const repartirGrupo = (lineaIds: number[], cuentaIds: number[]) =>
    accion(async () => {
      let resultado = cuentas;
      for (const lineaId of lineaIds) resultado = await api.repartirLinea(lineaId, cuentaIds);
      setCuentas(resultado);
      setRepartiendo(null);
      setPagos([]);
    });

  const quitarCuenta = (id_: number) =>
    accion(async () => {
      await api.eliminarCuenta(id_);
      await cargar();
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

  const aplicarDescuento = (datos: { pin: string; motivo: string }) =>
    accion(async () => {
      if (!cuenta || !descuentoBorrador) return;
      await api.aplicarDescuento(cuenta.id, { ...descuentoBorrador, motivo: datos.motivo, pinAutorizacion: datos.pin });
      setDescuentoBorrador(null);
      setPidiendoDescuento(false);
      await cargar();
      setPagos([]);
    });

  const agregarPago = () => {
    if (restante <= 0) return;
    setPagos((previo) => [
      ...previo,
      { metodo, montoCentavos: restante, referencia: '', ...(metodo === 'efectivo' && recibidoCentavos > 0 ? { recibidoCentavos } : {}) },
    ]);
    setRecibido('');
  };

  const cobrar = () =>
    accion(async () => {
      if (!cuenta) return;
      const finales: PagoBorrador[] =
        pagos.length > 0
          ? pagos
          : [{ metodo, montoCentavos: cuenta.totalCentavos, referencia: '', ...(metodo === 'efectivo' && recibidoCentavos > 0 ? { recibidoCentavos } : {}) }];

      setCobrando(true);
      try {
        // Clave única: si la red hace reintentar, no se cobra dos veces.
        const r = await api.cobrar(cuenta.id, finales, nuevaClave());
        setPagos([]);
        setRecibido('');
        setMostrarCobro(false);
        await cargar();
        if (r.ordenCerrada) navegar('/mesas');
      } finally {
        setCobrando(false);
      }
    });

  if (!orden || !cuenta) return <div className="cargando">Cargando la cuenta…</div>;

  return (
    <div className="contenido pantalla-cobro">
      <div className="barra compacta">
        <button className="btn chico" onClick={() => navegar('/mesas')}>◀ Mesas</button>
        <strong>Mesa {orden.mesaNombre}</strong>
        <span className="tenue">folio {orden.folio} · {orden.comensales}p</span>
        <span className="empuje" />
        <button className="btn chico fantasma" onClick={() => window.print()}>Imprimir</button>
      </div>

      {/* Las cuentas solo aparecen cuando de verdad hay más de una: en el caso
          normal —una cuenta por mesa— esta fila no existe y no distrae. */}
      {separada && (
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
            <h2>
              {separada ? cuenta.nombre : 'Cuenta'}
              {separada && cuenta.estado === 'abierta' && cuenta.lineas.length === 0 && (
                <button className="btn chico peligro" onClick={() => quitarCuenta(cuenta.id)}>Quitar cuenta</button>
              )}
            </h2>

            {cuenta.lineas.length === 0 && <p className="tenue">Sin consumo asignado.</p>}
            {agruparLineas(cuenta.lineas, cuentas).map((g) => (
              <div key={g.clave} className="linea">
                <div className="linea-datos">
                  <span className="linea-cantidad">
                    {cantidadLegible(g.cantidadMilesimas, g.unidad)}
                  </span>
                  <span className="linea-nombre">
                    {g.productoNombre}
                    {g.varianteNombre && <em> · {g.varianteNombre}</em>}
                    {g.esCortesia && <small className="nota">cortesía</small>}
                    {g.compartida && <small>compartido</small>}
                  </span>
                  <span className="linea-importe">
                    {pesos(g.importeCentavos)}
                  </span>
                </div>
                {cuenta.estado === 'abierta' && separada && !modoIgual && (
                  <div className="linea-acciones">
                    <button className="btn chico fantasma" onClick={() => setPasando(g)}>Pasar a…</button>
                    <button className="btn chico fantasma" onClick={() => setRepartiendo(g)}>Repartir…</button>
                  </div>
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
              {cuenta.propinaCentavos > 0 && <div><span>Propina</span><span>{pesos(cuenta.propinaCentavos)}</span></div>}
              <div className="gran-total"><span>Total</span><span>{pesos(cuenta.totalCentavos)}</span></div>
            </div>

            {/* Separar la cuenta es la excepción, no el camino: un enlace discreto
                al pie, no un botón que compita con cobrar. */}
            {cuenta.estado === 'abierta' && (
              <button className="enlace-pie" onClick={() => setSeparando('menu')}>
                {separada ? 'Ajustar cómo se reparte la cuenta' : '¿Van a pagar por separado?'}
              </button>
            )}
          </div>
        </div>

        <aside className={`panel derecho cobro${mostrarCobro ? ' hoja-abierta' : ''}`}>
          <div className="hoja-encabezado">
            <h2>{cuenta.estado === 'cobrada' ? 'Cuenta cobrada' : `Cobrar ${pesos(cuenta.totalCentavos)}`}</h2>
            <button className="btn chico fantasma solo-movil" onClick={() => setMostrarCobro(false)}>Cerrar</button>
          </div>

          <div className="hoja-cuerpo">
          {cuenta.estado === 'cobrada' ? (
            <>
              {cuenta.pagos.map((p) => (
                <p key={p.id}>
                  {ETIQUETAS_METODO[p.metodo]}: {pesos(p.montoCentavos)}
                  {p.cambioCentavos ? ` · cambio ${pesos(p.cambioCentavos)}` : ''}
                </p>
              ))}
              {abiertas.length > 0 && (
                <button className="btn primario grande" onClick={() => { setCuentaId(abiertas[0]!.id); setMostrarCobro(false); }}>
                  Sigue {abiertas[0]!.nombre} · {pesos(abiertas[0]!.totalCentavos)}
                </button>
              )}
              <button className="btn" onClick={() => window.print()}>Imprimir ticket</button>
            </>
          ) : !puede('admin', 'cajero') ? (
            <p className="detalle-dialogo">
              El cobro lo hace caja. Avisa al cajero: la mesa ya aparece con la cuenta pedida.
            </p>
          ) : (
            <>
              <div className="grupo-opciones">
                <h3>Propina</h3>
                <div className="opciones">
                  {sugeridas.map((p) => (
                    <button
                      key={p}
                      className={`opcion${cuenta.propinaCentavos > 0 && cuenta.propinaCentavos === Math.round((baseDePropina * p) / 100) ? ' elegida' : ''}`}
                      onClick={() => propina(p)}
                    >
                      {p}%
                    </button>
                  ))}
                  <button
                    className={`opcion${cuenta.propinaCentavos === 0 ? ' elegida' : ''}`}
                    onClick={() => propina(0)}
                  >
                    Sin propina
                  </button>
                </div>
              </div>

              <div className="grupo-opciones">
                <h3>Método</h3>
                <div className="opciones">
                  {(Object.keys(ETIQUETAS_METODO) as MetodoPago[]).map((m) => (
                    <button key={m} className={`opcion${metodo === m ? ' elegida' : ''}`} onClick={() => setMetodo(m)}>
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
              <button className="btn" onClick={() => setDescuentoBorrador({ tipo: 'porcentaje', valor: 10 })}>
                Aplicar descuento
              </button>

              {abiertas.length > 1 && (
                <p className="tenue">Quedan {abiertas.length - 1} cuenta(s) por cobrar en esta mesa.</p>
              )}
            </>
          )}
          </div>

          {/* La acción que cierra la venta no se esconde al fondo de un scroll. */}
          {cuenta.estado === 'abierta' && puede('admin', 'cajero') && (
            <div className="hoja-pie">
              <button
                className="btn primario grande"
                disabled={cobrando || efectivoInsuficiente || (pagos.length > 0 && restante > 0)}
                onClick={cobrar}
              >
                {cobrando ? 'Cobrando…' : `Cobrar ${pesos(cuenta.totalCentavos)}`}
              </button>
            </div>
          )}
        </aside>
      </div>

      {cuenta.estado === 'abierta' && puede('admin', 'cajero') && (
        <div className="barra-inferior">
          <button className="btn primario grande" onClick={() => setMostrarCobro(true)}>
            Cobrar {pesos(cuenta.totalCentavos)}
          </button>
        </div>
      )}

      {/* ── Separar la cuenta, en lenguaje de piso ── */}
      {separando === 'menu' && (
        <Dialogo titulo="¿Cómo van a pagar?" onCerrar={() => setSeparando(null)} ancho={460}>
          <button className="btn grande" onClick={() => setSeparando('iguales')}>
            Partes iguales
            <small>Cada quien paga lo mismo</small>
          </button>
          <button className="btn grande" onClick={() => setSeparando('porPlatillo')}>
            Cada quien lo que pidió
            <small>Se crean cuentas y repartes los platillos</small>
          </button>
          {separada && !modoIgual && (
            <button className="btn grande" onClick={() => setSeparando('repartir')}>
              Repartir un platillo compartido
              <small>La botana que pidieron entre todos</small>
            </button>
          )}
          <p className="tenue">Si nadie lo pide, deja una sola cuenta: es lo normal.</p>
        </Dialogo>
      )}

      {(separando === 'iguales' || separando === 'porPlatillo') && (
        <Dialogo
          titulo={separando === 'iguales' ? 'Partes iguales' : 'Cada quien lo que pidió'}
          onCerrar={() => setSeparando(null)}
          ancho={420}
          pie={
            <div className="acciones-dialogo">
              <button className="btn" onClick={() => setSeparando('menu')}>Atrás</button>
              <button
                className="btn primario"
                onClick={() => (separando === 'iguales' ? dividirIgual(partes) : crearCuentasVacias(partes))}
              >
                {separando === 'iguales' ? `Dividir entre ${partes}` : `Crear ${partes} cuentas`}
              </button>
            </div>
          }
        >
          <p className="detalle-dialogo">
            {separando === 'iguales'
              ? 'El total se divide en partes exactas y todas ven la misma cuenta: no se pueden mover platillos entre ellas.'
              : 'Se crean las cuentas vacías y después pasas cada platillo a la suya con “Pasar a…”.'}
          </p>
          <div className="contador grande">
            <button className="btn" onClick={() => setPartes((p) => Math.max(2, p - 1))}>−</button>
            <span className="contador-valor">{partes}</span>
            <button className="btn" onClick={() => setPartes((p) => Math.min(20, p + 1))}>+</button>
          </div>
        </Dialogo>
      )}

      {pasando !== null && (
        <PasarPlatillo
          grupo={pasando}
          abiertas={abiertas}
          onCerrar={() => setPasando(null)}
          onMover={(cantidadMilesimas, destinoId) => moverGrupo(pasando.lineaIds, cantidadMilesimas, destinoId)}
        />
      )}

      {repartiendo !== null && (
        <RepartirPlatillo
          cuentas={abiertas}
          onCerrar={() => setRepartiendo(null)}
          onRepartir={(ids) => repartirGrupo(repartiendo.lineaIds, ids)}
        />
      )}

      {separando === 'repartir' && (
        <Dialogo
          titulo="Repartir un platillo"
          onCerrar={() => setSeparando(null)}
          ancho={420}
          pie={<div className="acciones-dialogo"><button className="btn primario" onClick={() => setSeparando(null)}>Entendido</button></div>}
        >
          <p className="detalle-dialogo">
            Toca “Repartir…” junto al platillo compartido en el ticket y elige entre qué cuentas se divide.
          </p>
        </Dialogo>
      )}

      {descuentoBorrador && !pidiendoDescuento && (
        <Dialogo
          titulo="Descuento"
          onCerrar={() => setDescuentoBorrador(null)}
          ancho={420}
          pie={
            <div className="acciones-dialogo">
              <button className="btn" onClick={() => setDescuentoBorrador(null)}>Cancelar</button>
              <button className="btn primario" onClick={() => setPidiendoDescuento(true)}>Continuar</button>
            </div>
          }
        >
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

/** Mueve un platillo (o varias piezas de uno) a otra cuenta. Solo pregunta
 *  cuántas piezas cuando de verdad hay más de una y son piezas enteras: partir
 *  un platillo por peso (kg) no tiene el mismo sentido. */
function PasarPlatillo({
  grupo,
  abiertas,
  onCerrar,
  onMover,
}: {
  grupo: GrupoLinea;
  abiertas: Cuenta[];
  onCerrar: () => void;
  onMover: (cantidadMilesimas: number, destinoId: number) => void;
}) {
  const totalUnidades = Math.round(grupo.cantidadMilesimas / 1000);
  const permiteParcial = grupo.unidad === 'pieza' && totalUnidades > 1;
  const [unidades, setUnidades] = useState(1);

  return (
    <Dialogo titulo="Pasar a otra cuenta" onCerrar={onCerrar} ancho={380}>
      {permiteParcial ? (
        <>
          <p className="detalle-dialogo">¿Cuántas de {totalUnidades} “{grupo.productoNombre}” se mueven?</p>
          <div className="contador grande">
            <button className="btn" onClick={() => setUnidades((u) => Math.max(1, u - 1))}>−</button>
            <span className="contador-valor">{unidades}</span>
            <button className="btn" onClick={() => setUnidades((u) => Math.min(totalUnidades, u + 1))}>+</button>
          </div>
        </>
      ) : (
        <p className="detalle-dialogo">El platillo completo se mueve a la cuenta que elijas.</p>
      )}
      <p className="detalle-dialogo">¿A qué cuenta?</p>
      <div className="opciones">
        {abiertas.map((c) => (
          <button
            key={c.id}
            className="opcion"
            onClick={() => onMover(permiteParcial ? unidades * 1000 : grupo.cantidadMilesimas, c.id)}
          >
            {c.nombre}
          </button>
        ))}
      </div>
    </Dialogo>
  );
}

/** Un platillo compartido se divide entre las cuentas que lo comieron. */
function RepartirPlatillo({
  cuentas,
  onCerrar,
  onRepartir,
}: {
  cuentas: Cuenta[];
  onCerrar: () => void;
  onRepartir: (cuentaIds: number[]) => void;
}) {
  const [elegidas, setElegidas] = useState<Set<number>>(new Set(cuentas.map((c) => c.id)));

  return (
    <Dialogo
      titulo="Repartir entre…"
      onCerrar={onCerrar}
      ancho={400}
      pie={
        <div className="acciones-dialogo">
          <button className="btn" onClick={onCerrar}>Cancelar</button>
          <button className="btn primario" disabled={elegidas.size === 0} onClick={() => onRepartir([...elegidas])}>
            Repartir entre {elegidas.size}
          </button>
        </div>
      }
    >
      <p className="detalle-dialogo">El importe se divide en partes exactas entre las cuentas que marques.</p>
      <div className="opciones">
        {cuentas.map((c) => (
          <button
            key={c.id}
            className={`opcion${elegidas.has(c.id) ? ' elegida' : ''}`}
            onClick={() =>
              setElegidas((previo) => {
                const siguiente = new Set(previo);
                if (siguiente.has(c.id)) siguiente.delete(c.id);
                else siguiente.add(c.id);
                return siguiente;
              })
            }
          >
            {c.nombre}
          </button>
        ))}
      </div>
    </Dialogo>
  );
}

/** Lo que le toca a esta cuenta de una línea que puede estar compartida. */
function importeEnCuenta(linea: { id: number; totalCentavos: number; cuentaIds?: number[] }, cuentas: Cuenta[]): number {
  const compartida = cuentas.filter((c) => c.lineas.some((l) => l.id === linea.id)).length || 1;
  return Math.round(linea.totalCentavos / compartida);
}

interface GrupoLinea {
  clave: string;
  productoNombre: string;
  varianteNombre: string;
  esCortesia: boolean;
  unidad: string;
  cantidadMilesimas: number;
  importeCentavos: number;
  lineaIds: number[];
  compartida: boolean;
}

/** Agrupa las líneas del ticket por platillo: si se pidieron 2 cocas y luego
 *  1 más, se ven como "3 Coca" en vez de dos renglones separados. */
function agruparLineas(lineas: Cuenta['lineas'], cuentas: Cuenta[]): GrupoLinea[] {
  const mapa = new Map<string, GrupoLinea>();
  for (const l of lineas) {
    const clave = `${l.productoId ?? l.productoNombre}|${l.varianteNombre}|${l.esCortesia}|${l.nota}`;
    const importe = importeEnCuenta(l, cuentas);
    const existente = mapa.get(clave);
    if (existente) {
      existente.cantidadMilesimas += l.cantidadMilesimas;
      existente.importeCentavos += importe;
      existente.lineaIds.push(l.id);
      existente.compartida = existente.compartida || (l.cuentaIds?.length ?? 1) > 1;
    } else {
      mapa.set(clave, {
        clave,
        productoNombre: l.productoNombre,
        varianteNombre: l.varianteNombre,
        esCortesia: l.esCortesia,
        unidad: l.unidad,
        cantidadMilesimas: l.cantidadMilesimas,
        importeCentavos: importe,
        lineaIds: [l.id],
        compartida: (l.cuentaIds?.length ?? 1) > 1,
      });
    }
  }
  return [...mapa.values()].map((g) => ({ ...g, lineaIds: [...g.lineaIds].sort((a, b) => a - b) }));
}
