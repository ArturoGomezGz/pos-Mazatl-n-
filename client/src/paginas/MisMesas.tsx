import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ErrorApi } from '../api/cliente';
import { Dialogo } from '../componentes/Dialogo';
import { useSesion } from '../estado/Sesion';
import {
  ETIQUETAS_URGENCIA,
  minutosDesde,
  ordenarPorUrgencia,
  pesos,
  urgenciaDe,
  type MesaTablero,
} from '../tipos';

const REFRESCO_MS = 15_000;
const MINUTOS_ABANDONO = 25;

/** Punto de entrada del mesero. Reemplaza al plano del comedor: el mesero se
 *  sabe su salón de memoria, lo que no puede saber de un vistazo es qué mesa
 *  lleva 40 minutos esperando o cuál ya tiene comida lista en la barra. */
export function MisMesas() {
  const navegar = useNavigate();
  const { usuario } = useSesion();
  const [mesas, setMesas] = useState<MesaTablero[]>([]);
  const [soloMias, setSoloMias] = useState(usuario?.rol === 'mesero');
  const [abriendo, setAbriendo] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setMesas(await api.tablero());
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar el tablero');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
    const t = setInterval(() => void cargar(), REFRESCO_MS);
    return () => clearInterval(t);
  }, [cargar]);

  async function accion(fn: () => Promise<void>) {
    try {
      await fn();
      await cargar();
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'Ocurrió un error');
    }
  }

  const abiertas = mesas.filter((m) => m.orden || m.estado === 'por_limpiar');
  const propias = soloMias && usuario ? abiertas.filter((m) => !m.orden || m.orden.meseroId === usuario.id) : abiertas;
  const enOrden = ordenarPorUrgencia(propias);
  const libres = mesas.filter((m) => !m.orden && m.estado !== 'por_limpiar');
  const ajenas = abiertas.length - propias.length;

  if (cargando) return <div className="cargando">Cargando tus mesas…</div>;

  return (
    <div className="contenido">
      <div className="barra">
        <strong>Mis mesas</strong>
        <span className="tenue">{enOrden.length} en servicio</span>
        <span className="empuje" />
        {usuario?.rol !== 'cocina' && (
          <button className="btn chico" onClick={() => setSoloMias((v) => !v)}>
            {soloMias ? `Ver todas${ajenas > 0 ? ` (+${ajenas})` : ''}` : 'Ver solo las mías'}
          </button>
        )}
        <button className="btn chico fantasma" onClick={() => navegar('/mapa')}>Ver plano</button>
      </div>

      {error && <div className="aviso">{error}</div>}

      <div className="lista-mesas">
        {enOrden.map((mesa) => (
          <TarjetaMesa
            key={mesa.id}
            mesa={mesa}
            esMia={!mesa.orden || mesa.orden.meseroId === usuario?.id}
            onEntrar={() => navegar(`/orden/${mesa.id}`)}
            onCobrar={() => mesa.orden && navegar(`/cobro/${mesa.orden.id}`)}
            onEntregar={() => mesa.orden && accion(async () => { await api.marcarEntregado(mesa.orden!.id); })}
            onLimpiar={() => accion(async () => { await api.cambiarEstadoMesa(mesa.id, 'libre'); })}
            onCancelar={() =>
              accion(async () => {
                if (mesa.orden && confirm(`¿Cerrar la mesa ${mesa.nombre}? No tiene consumo capturado.`)) {
                  await api.cancelarMesaVacia(mesa.orden.id);
                }
              })
            }
          />
        ))}

        {enOrden.length === 0 && (
          <div className="vacio">
            No tienes mesas abiertas. Toca <b>Abrir mesa</b> para empezar.
          </div>
        )}
      </div>

      {/* Acción principal siempre al alcance del pulgar, no arriba de la pantalla. */}
      <div className="barra-inferior">
        <button className="btn primario grande" onClick={() => setAbriendo(true)}>+ Abrir mesa</button>
      </div>

      {abriendo && (
        <SelectorDeMesa
          libres={libres}
          onCerrar={() => setAbriendo(false)}
          onElegir={(mesa) => {
            setAbriendo(false);
            navegar(`/orden/${mesa.id}`);
          }}
        />
      )}
    </div>
  );
}

function TarjetaMesa({
  mesa,
  esMia,
  onEntrar,
  onCobrar,
  onEntregar,
  onLimpiar,
  onCancelar,
}: {
  mesa: MesaTablero;
  esMia: boolean;
  onEntrar: () => void;
  onCobrar: () => void;
  onEntregar: () => void;
  onLimpiar: () => void;
  onCancelar: () => void;
}) {
  const urgencia = urgenciaDe(mesa);
  const minutos = mesa.orden ? minutosDesde(mesa.orden.abiertaEn) : 0;
  const abandonada = urgencia === 'esperando' && minutos >= MINUTOS_ABANDONO;

  return (
    <article className={`tarjeta-mesa urgencia-${urgencia}${abandonada ? ' abandonada' : ''}`}>
      <button className="tarjeta-mesa-principal" onClick={onEntrar}>
        <span className="mesa-codigo">{mesa.nombre}</span>
        <span className="mesa-medio">
          <span className="mesa-motivo">
            {ETIQUETAS_URGENCIA[urgencia]}
            {urgencia === 'listo' && mesa.orden ? ` · ${mesa.orden.listas}` : ''}
            {urgencia === 'sin_enviar' && mesa.orden ? ` · ${mesa.orden.sinEnviar}` : ''}
          </span>
          <span className="mesa-detalle">
            {mesa.zona}
            {mesa.orden ? ` · ${mesa.orden.comensales}p · ${minutos} min` : ''}
            {!esMia && mesa.orden ? ` · ${mesa.orden.mesero}` : ''}
          </span>
        </span>
        {mesa.orden && <span className="mesa-total">{pesos(mesa.orden.totalCentavos)}</span>}
      </button>

      <div className="tarjeta-mesa-acciones">
        {urgencia === 'listo' && (
          <button className="btn chico primario" onClick={onEntregar}>Entregado</button>
        )}
        {mesa.orden && !mesa.orden.vacia && (
          <button className="btn chico" onClick={onCobrar}>Cuenta</button>
        )}
        {mesa.orden?.vacia && (
          <button className="btn chico peligro" onClick={onCancelar}>Cerrar mesa</button>
        )}
        {!mesa.orden && mesa.estado === 'por_limpiar' && (
          <button className="btn chico" onClick={onLimpiar}>Marcar limpia</button>
        )}
      </div>
    </article>
  );
}

/** Rejilla de códigos de mesa agrupada por zona: el mesero busca "T-4", no un
 *  punto en un dibujo. */
function SelectorDeMesa({
  libres,
  onCerrar,
  onElegir,
}: {
  libres: MesaTablero[];
  onCerrar: () => void;
  onElegir: (mesa: MesaTablero) => void;
}) {
  const zonas = [...new Set(libres.map((m) => m.zona))];

  return (
    <Dialogo titulo="Abrir mesa" onCerrar={onCerrar} ancho={520}>
      {zonas.map((zona) => (
        <div key={zona} className="grupo-opciones">
          <h3>{zona}</h3>
          <div className="rejilla-mesas">
            {libres
              .filter((m) => m.zona === zona)
              .map((mesa) => (
                <button key={mesa.id} className="codigo-mesa" onClick={() => onElegir(mesa)}>
                  <strong>{mesa.nombre}</strong>
                  <small>{mesa.capacidad}p</small>
                </button>
              ))}
          </div>
        </div>
      ))}
      {libres.length === 0 && <p className="tenue">No hay mesas libres en este momento.</p>}
    </Dialogo>
  );
}
