import { useEffect, useMemo, useState } from 'react';
import { api, ErrorApi } from '../api/cliente';
import { Lienzo } from '../componentes/Lienzo';
import { usePlano } from '../hooks/usePlano';
import { ETIQUETAS_ESTADO, type EstadoMesa, type Mesa } from '../tipos';

const REFRESCO_MS = 10_000;

/** Vista de piso: lo que ve el mesero. Todavía sin órdenes; por ahora permite
 *  cambiar el estado de la mesa a mano para validar el flujo visual. */
export function VistaSalon() {
  const { plano, cargando, error, setError, recargar } = usePlano();
  const [zonaId, setZonaId] = useState<number | null>(null);
  const [mesaAbierta, setMesaAbierta] = useState<Mesa | null>(null);

  const zonas = plano?.zonas ?? [];
  const zona = useMemo(() => zonas.find((z) => z.id === zonaId) ?? zonas[0], [zonas, zonaId]);

  // El plano es una pantalla viva: se refresca sola mientras nadie la toca.
  useEffect(() => {
    if (mesaAbierta) return;
    const t = setInterval(() => void recargar(), REFRESCO_MS);
    return () => clearInterval(t);
  }, [recargar, mesaAbierta]);

  async function cambiarEstado(mesa: Mesa, estado: EstadoMesa) {
    try {
      await api.actualizarMesa(mesa.id, { estado });
      setMesaAbierta(null);
      await recargar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo actualizar la mesa');
    }
  }

  if (cargando && !plano) return <div className="cargando">Cargando el comedor…</div>;
  if (!plano) return <div className="aviso">{error ?? 'No se pudo cargar el plano'}</div>;

  const visible = zona ? { ...zona, mesas: zona.mesas.filter((m) => m.activa) } : undefined;

  return (
    <div className="contenido">
      <div className="pestanas">
        {zonas.map((z) => (
          <button
            key={z.id}
            className={`pestana${z.id === zona?.id ? ' activa' : ''}`}
            onClick={() => setZonaId(z.id)}
          >
            {z.nombre}
          </button>
        ))}
      </div>

      {error && <div className="aviso">{error}</div>}

      {mesaAbierta && (
        <div className="aviso info">
          <div style={{ marginBottom: 10 }}>
            Mesa <b>{mesaAbierta.nombre}</b> · {mesaAbierta.capacidad} personas · {ETIQUETAS_ESTADO[mesaAbierta.estado]}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(Object.keys(ETIQUETAS_ESTADO) as EstadoMesa[]).map((estado) => (
              <button key={estado} className="btn chico" onClick={() => cambiarEstado(mesaAbierta, estado)}>
                {ETIQUETAS_ESTADO[estado]}
              </button>
            ))}
            <button className="btn chico fantasma" onClick={() => setMesaAbierta(null)}>Cerrar</button>
          </div>
        </div>
      )}

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
            onAbrirMesa={setMesaAbierta}
          />
        ) : (
          <div className="vacio">No hay zonas configuradas. Ve al editor para diseñar el comedor.</div>
        )}
      </div>

      <div className="leyenda">
        <span><i style={{ background: '#e8f6ee', borderColor: 'var(--estado-libre)' }} /> Libre</span>
        <span><i style={{ background: '#fdeae4', borderColor: 'var(--estado-ocupada)' }} /> Ocupada</span>
        <span><i style={{ background: '#fdf2dc', borderColor: 'var(--estado-cuenta)' }} /> Cuenta pedida</span>
        <span><i style={{ background: '#eef1f3', borderColor: 'var(--estado-limpiar)' }} /> Por limpiar</span>
        <span><i style={{ background: '#efeafa', borderColor: 'var(--estado-reservada)' }} /> Reservada</span>
      </div>
    </div>
  );
}
