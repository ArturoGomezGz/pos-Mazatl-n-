import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ErrorApi, nuevaClave } from '../api/cliente';
import { DialogoProducto, type LineaCapturada } from '../componentes/DialogoProducto';
import { MenuVenta } from '../componentes/MenuVenta';
import { PedirAutorizacion } from '../componentes/PedirAutorizacion';
import { useSesion } from '../estado/Sesion';
import { cantidadLegible, leerEstiloMenu, pesos, type Categoria, type Linea, type Mesa, type Orden, type Producto } from '../tipos';

export function TomaOrden() {
  const { mesaId } = useParams();
  const navegar = useNavigate();
  const { config, puede } = useSesion();
  const estilo = leerEstiloMenu(config);

  const [orden, setOrden] = useState<Orden | null>(null);
  const [mesa, setMesa] = useState<Mesa | null>(null);
  const [menu, setMenu] = useState<Categoria[]>([]);
  const [comensales, setComensales] = useState(2);
  // Un lugar de barra es para una sola persona: no tiene caso preguntar.
  const esLugarDeBarra = mesa?.forma === 'barra';
  const [eligiendo, setEligiendo] = useState<Producto | null>(null);
  const [cancelando, setCancelando] = useState<Linea | null>(null);
  const [mostrarOrden, setMostrarOrden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const idMesa = Number(mesaId);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [existente, catalogo, mesaInfo] = await Promise.all([api.ordenDeMesa(idMesa), api.menu(), api.mesa(idMesa)]);
      setOrden(existente);
      setMenu(catalogo);
      setMesa(mesaInfo);
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar la mesa');
    } finally {
      setCargando(false);
    }
  }, [idMesa]);

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

  const abrirMesa = () => accion(async () => setOrden(await api.abrirOrden(idMesa, esLugarDeBarra ? 1 : comensales)));

  const agregar = (linea: LineaCapturada) =>
    accion(async () => {
      if (!orden) return;
      setOrden(await api.agregarLineas(orden.id, [linea]));
      setEligiendo(null);
    });

  const quitar = (linea: Linea) =>
    accion(async () => {
      await api.eliminarLinea(linea.id);
      await cargar();
    });

  const enviar = () =>
    accion(async () => {
      if (!orden) return;
      setEnviando(true);
      try {
        // La clave hace que un reintento por Wi-Fi malo no duplique la comanda.
        const r = await api.enviarComanda(orden.id, nuevaClave());
        setOrden(r.orden);
        setMostrarOrden(false);
      } finally {
        setEnviando(false);
      }
    });

  const pedirCuenta = () =>
    accion(async () => {
      if (!orden) return;
      await api.pedirCuenta(orden.id);
      navegar('/mesas');
    });

  const cerrarMesaVacia = () =>
    accion(async () => {
      if (!orden) return;
      await api.cancelarMesaVacia(orden.id);
      navegar('/mesas');
    });

  const alternarDisponibilidad = (producto: Producto) =>
    accion(async () => {
      await api.disponibilidad(producto.id, !producto.disponibleHoy);
      setMenu(await api.menu());
    });

  const cancelarLinea = (datos: { pin: string; motivo: string }) =>
    accion(async () => {
      if (!cancelando) return;
      await api.cancelarLinea(cancelando.id, { motivo: datos.motivo, pinAutorizacion: datos.pin, esCortesia: false });
      setCancelando(null);
      await cargar();
    });

  if (cargando) return <div className="cargando">Cargando la mesa…</div>;

  if (!orden) {
    return (
      <div className="contenido">
        <div className="panel-central">
          <h2>Abrir {esLugarDeBarra ? 'lugar de barra' : 'mesa'}</h2>
          {esLugarDeBarra ? (
            <p className="detalle-dialogo">Un lugar de barra es para una persona.</p>
          ) : (
            <>
              <p className="detalle-dialogo">¿Cuántas personas se sientan?</p>
              <div className="contador grande">
                <button className="btn" onClick={() => setComensales((c) => Math.max(1, c - 1))}>−</button>
                <span className="contador-valor">{comensales}</span>
                <button className="btn" onClick={() => setComensales((c) => Math.min(40, c + 1))}>+</button>
              </div>
            </>
          )}
          {error && <div className="aviso">{error}</div>}
          <div className="acciones-dialogo">
            <button className="btn" onClick={() => navegar('/mesas')}>Volver</button>
            <button className="btn primario" onClick={abrirMesa}>Abrir mesa</button>
          </div>
        </div>
      </div>
    );
  }

  const activas = orden.lineas.filter((l) => l.estado !== 'cancelada');
  const pendientes = activas.filter((l) => l.estado === 'pendiente');
  const enviadas = activas.filter((l) => l.estado !== 'pendiente');
  const total = activas.reduce((a, l) => a + l.totalCentavos, 0);
  const puedeCobrar = puede('admin', 'cajero');

  return (
    <div className="contenido pantalla-orden">
      <div className="barra compacta">
        <button className="btn chico" onClick={() => navegar('/mesas')}>◀ Mesas</button>
        <strong>Mesa {orden.mesaNombre}</strong>
        <span className="tenue">{orden.comensales}p · {orden.meseroNombre}</span>
        <span className="empuje" />
        {activas.length === 0 ? (
          <button className="btn chico peligro" onClick={cerrarMesaVacia}>Cerrar mesa</button>
        ) : puedeCobrar ? (
          <button className="btn chico" onClick={() => navegar(`/cobro/${orden.id}`)}>Cuenta</button>
        ) : (
          <button className="btn chico" onClick={pedirCuenta}>Pedir cuenta</button>
        )}
      </div>

      {error && <div className="aviso">{error}</div>}

      <div className="cuerpo">
        <div className="columna-menu">
          <MenuVenta
            categorias={menu}
            estilo={estilo}
            onElegir={setEligiendo}
            onAlternarDisponibilidad={alternarDisponibilidad}
          />
        </div>

        <aside className={`panel derecho comanda${mostrarOrden ? ' hoja-abierta' : ''}`}>
          <div className="hoja-encabezado">
            <h2>Orden · {pesos(total)}</h2>
            <button className="btn chico fantasma solo-movil" onClick={() => setMostrarOrden(false)}>Cerrar</button>
          </div>

          <div className="hoja-cuerpo">
          {pendientes.length > 0 && (
            <>
              <h3 className="subtitulo">Por enviar</h3>
              {pendientes.map((l) => (
                <FilaLinea key={l.id} linea={l} onQuitar={() => quitar(l)} />
              ))}
            </>
          )}

          {enviadas.length > 0 && (
            <>
              <h3 className="subtitulo">Ya en cocina</h3>
              {enviadas.map((l) => (
                <FilaLinea key={l.id} linea={l} onCancelar={() => setCancelando(l)} />
              ))}
            </>
          )}

          {activas.length === 0 && <p className="tenue">Toca un producto del menú para empezar.</p>}

          <div className="total-comanda">
            <span>Total</span>
            <strong>{pesos(total)}</strong>
          </div>
          </div>

          <div className="hoja-pie">
            <button className="btn primario grande" disabled={!pendientes.length || enviando} onClick={enviar}>
              {enviando ? 'Enviando…' : `Enviar a cocina (${pendientes.length})`}
            </button>
          </div>
        </aside>
      </div>

      {/* Zona del pulgar: lo que el mesero toca cien veces por turno vive abajo. */}
      <div className="barra-inferior doble">
        <button className="btn grande" onClick={() => setMostrarOrden(true)}>
          Ver orden ({activas.length}) · {pesos(total)}
        </button>
        <button className="btn primario grande" disabled={!pendientes.length || enviando} onClick={enviar}>
          {enviando ? 'Enviando…' : `Enviar (${pendientes.length})`}
        </button>
      </div>

      {eligiendo && <DialogoProducto producto={eligiendo} onCancelar={() => setEligiendo(null)} onAgregar={agregar} />}

      {cancelando && (
        <PedirAutorizacion
          titulo="Cancelar platillo enviado"
          detalle={`${cancelando.productoNombre} ya está en cocina. Cancelarlo requiere autorización.`}
          onCancelar={() => setCancelando(null)}
          onConfirmar={cancelarLinea}
        />
      )}
    </div>
  );
}

function FilaLinea({ linea, onQuitar, onCancelar }: { linea: Linea; onQuitar?: () => void; onCancelar?: () => void }) {
  return (
    <div className="linea">
      <div className="linea-datos">
        <span className="linea-cantidad">{cantidadLegible(linea.cantidadMilesimas, linea.unidad)}</span>
        <span className="linea-nombre">
          {linea.productoNombre}
          {linea.varianteNombre && <em> · {linea.varianteNombre}</em>}
          {linea.modificadores.map((m) => (
            <small key={m.id}>· {m.nombre}</small>
          ))}
          {linea.nota && <small className="nota">“{linea.nota}”</small>}
        </span>
        <span className="linea-importe">{pesos(linea.totalCentavos)}</span>
      </div>
      {onQuitar && <button className="btn chico fantasma" onClick={onQuitar}>Quitar</button>}
      {onCancelar && <button className="btn chico fantasma peligro" onClick={onCancelar}>Cancelar</button>}
    </div>
  );
}
