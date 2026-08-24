import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lienzo } from '../componentes/Lienzo';
import { usePlano } from '../hooks/usePlano';
import { ETIQUETAS_ESTADO, type EstadoMesa } from '../tipos';

/** Vista de consulta del comedor. **No** es el camino diario del mesero: él se
 *  sabe su salón. Está aquí como ayuda puntual —ubicar una mesa que no conoce,
 *  enseñarle el acomodo a alguien nuevo— y se llega desde “Mis mesas”. */
export function MapaConsulta() {
  const navegar = useNavigate();
  const { plano, cargando, error } = usePlano();
  const [zonaId, setZonaId] = useState<number | null>(null);

  const zonas = plano?.zonas ?? [];
  const zona = useMemo(() => zonas.find((z) => z.id === zonaId) ?? zonas[0], [zonas, zonaId]);

  if (cargando && !plano) return <div className="cargando">Cargando el plano…</div>;
  if (!plano) return <div className="aviso">{error ?? 'No se pudo cargar el plano'}</div>;

  const visible = zona ? { ...zona, mesas: zona.mesas.filter((m) => m.activa), barras: zona.barras.filter((b) => b.activa) } : undefined;

  return (
    <div className="contenido">
      <div className="barra compacta">
        <button className="btn chico" onClick={() => navegar('/mesas')}>◀ Mis mesas</button>
        <strong>Plano del comedor</strong>
        <span className="tenue">solo consulta</span>
      </div>

      <div className="pestanas">
        {zonas.map((z) => (
          <button key={z.id} className={`pestana${z.id === zona?.id ? ' activa' : ''}`} onClick={() => setZonaId(z.id)}>
            {z.nombre}
          </button>
        ))}
      </div>

      <div className="cuerpo">
        {visible ? (
          <Lienzo
            zona={visible}
            escala={1}
            cuadricula={0}
            editable={false}
            mostrarEstados
            seleccion={null}
            onSeleccionar={() => {}}
            onGeometria={() => {}}
            onAbrirMesa={(mesa) => navegar(`/orden/${mesa.id}`)}
          />
        ) : (
          <div className="vacio">No hay zonas configuradas.</div>
        )}
      </div>

      <div className="leyenda">
        {(Object.keys(ETIQUETAS_ESTADO) as EstadoMesa[]).map((estado) => (
          <span key={estado}>
            <i className={`muestra-estado estado-${estado}`} /> {ETIQUETAS_ESTADO[estado]}
          </span>
        ))}
      </div>
    </div>
  );
}
