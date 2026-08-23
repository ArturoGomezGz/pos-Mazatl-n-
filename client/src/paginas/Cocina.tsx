import { useCallback, useEffect, useState } from 'react';
import { api, ErrorApi } from '../api/cliente';
import { cantidadLegible, type Comanda, type Estacion } from '../tipos';

const REFRESCO_MS = 8_000;
const MINUTOS_ALERTA = 12;

/** Pantalla de cocina: comandas por antigüedad y un solo botón por comanda.
 *  En cocina no se navega, se toca una vez. */
export function Cocina() {
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [estacion, setEstacion] = useState<Estacion | 'todas'>('todas');
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setComandas(await api.comandasPendientes(estacion === 'todas' ? undefined : estacion));
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar la cocina');
    }
  }, [estacion]);

  useEffect(() => {
    void cargar();
    const t = setInterval(() => void cargar(), REFRESCO_MS);
    return () => clearInterval(t);
  }, [cargar]);

  async function marcarLista(id: number) {
    await api.comandaLista(id);
    await cargar();
  }

  return (
    <div className="contenido">
      <div className="barra">
        <strong>Cocina y barra</strong>
        <span className="tenue">{comandas.length} comanda(s) pendiente(s)</span>
        <span className="empuje" />
        {(['todas', 'cocina', 'barra'] as const).map((e) => (
          <button key={e} className={`btn chico${estacion === e ? ' primario' : ''}`} onClick={() => setEstacion(e)}>
            {e === 'todas' ? 'Todas' : e === 'cocina' ? 'Cocina' : 'Barra'}
          </button>
        ))}
      </div>

      {error && <div className="aviso">{error}</div>}

      <div className="tablero-cocina">
        {comandas.map((c) => (
          <TarjetaComanda key={c.id} comanda={c} onLista={() => marcarLista(c.id)} />
        ))}
        {comandas.length === 0 && <div className="vacio">Todo al día. No hay comandas pendientes.</div>}
      </div>
    </div>
  );
}

function TarjetaComanda({ comanda, onLista }: { comanda: Comanda; onLista: () => void }) {
  const minutos = Math.floor((Date.now() - new Date(comanda.enviadaEn.replace(' ', 'T') + 'Z').getTime()) / 60000);
  const demorada = minutos >= MINUTOS_ALERTA;

  return (
    <article className={`comanda-tarjeta${demorada ? ' demorada' : ''}`}>
      <header>
        <strong>Mesa {comanda.mesa}</strong>
        <span>{Number.isFinite(minutos) && minutos >= 0 ? `${minutos} min` : ''}{demorada ? ' ⚠' : ''}</span>
      </header>
      <p className="tenue">{comanda.estacion === 'barra' ? 'Barra' : 'Cocina'} · {comanda.mesero}</p>
      <ul>
        {comanda.lineas.map((l) => (
          <li key={l.id}>
            <b>{cantidadLegible(l.cantidadMilesimas, l.unidad)}</b> {l.productoNombre}
            {l.varianteNombre && <em> · {l.varianteNombre}</em>}
            {l.modificadores.map((m) => (
              <small key={m.id}> · {m.nombre}</small>
            ))}
            {l.nota && <small className="nota">“{l.nota}”</small>}
          </li>
        ))}
      </ul>
      <button className="btn primario grande" onClick={onLista}>Listo</button>
    </article>
  );
}
