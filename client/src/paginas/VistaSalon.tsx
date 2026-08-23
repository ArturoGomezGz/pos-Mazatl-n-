import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ErrorApi } from '../api/cliente';
import { Dialogo } from '../componentes/Dialogo';
import { Lienzo } from '../componentes/Lienzo';
import { usePlano } from '../hooks/usePlano';
import { ETIQUETAS_ESTADO, pesos, type EstadoMesa, type Mesa, type Orden } from '../tipos';

const REFRESCO_MS = 10_000;

/** Vista de piso: el punto de entrada del mesero. Tocar una mesa abre su orden. */
export function VistaSalon() {
  const navegar = useNavigate();
  const { plano, cargando, error, setError, recargar } = usePlano();
  const [zonaId, setZonaId] = useState<number | null>(null);
  const [mesaAbierta, setMesaAbierta] = useState<Mesa | null>(null);
  const [ordenDeMesa, setOrdenDeMesa] = useState<Orden | null>(null);

  const zonas = plano?.zonas ?? [];
  const zona = useMemo(() => zonas.find((z) => z.id === zonaId) ?? zonas[0], [zonas, zonaId]);

  // Pantalla viva: se refresca sola mientras nadie la está usando.
  useEffect(() => {
    if (mesaAbierta) return;
    const t = setInterval(() => void recargar(), REFRESCO_MS);
    return () => clearInterval(t);
  }, [recargar, mesaAbierta]);

  const abrirDetalle = useCallback(async (mesa: Mesa) => {
    setMesaAbierta(mesa);
    setOrdenDeMesa(null);
    if (mesa.estado === 'ocupada' || mesa.estado === 'cuenta_pedida') {
      try {
        setOrdenDeMesa(await api.ordenDeMesa(mesa.id));
      } catch {
        /* si falla, el detalle igual sirve para navegar */
      }
    }
  }, []);

  async function cambiarEstado(mesa: Mesa, estado: EstadoMesa) {
    try {
      await api.cambiarEstadoMesa(mesa.id, estado);
      setMesaAbierta(null);
      await recargar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo actualizar la mesa');
    }
  }

  if (cargando && !plano) return <div className="cargando">Cargando el comedor…</div>;
  if (!plano) return <div className="aviso">{error ?? 'No se pudo cargar el plano'}</div>;

  const visible = zona ? { ...zona, mesas: zona.mesas.filter((m) => m.activa) } : undefined;
  const consumo = ordenDeMesa?.lineas.filter((l) => l.estado !== 'cancelada').reduce((a, l) => a + l.totalCentavos, 0) ?? 0;

  return (
    <div className="contenido">
      <div className="pestanas">
        {zonas.map((z) => (
          <button key={z.id} className={`pestana${z.id === zona?.id ? ' activa' : ''}`} onClick={() => setZonaId(z.id)}>
            {z.nombre}
          </button>
        ))}
      </div>

      {error && <div className="aviso">{error}</div>}

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
            onAbrirMesa={abrirDetalle}
          />
        ) : (
          <div className="vacio">No hay zonas configuradas. Ve a “Comedor” para diseñar el salón.</div>
        )}
      </div>

      <div className="leyenda">
        <span><i style={{ background: '#e8f6ee', borderColor: 'var(--estado-libre)' }} /> Libre</span>
        <span><i style={{ background: '#fdeae4', borderColor: 'var(--estado-ocupada)' }} /> Ocupada</span>
        <span><i style={{ background: '#fdf2dc', borderColor: 'var(--estado-cuenta)' }} /> Cuenta pedida</span>
        <span><i style={{ background: '#eef1f3', borderColor: 'var(--estado-limpiar)' }} /> Por limpiar</span>
        <span><i style={{ background: '#efeafa', borderColor: 'var(--estado-reservada)' }} /> Reservada</span>
      </div>

      {mesaAbierta && (
        <Dialogo titulo={`Mesa ${mesaAbierta.nombre}`} onCerrar={() => setMesaAbierta(null)} ancho={420}>
          <p className="detalle-dialogo">
            {mesaAbierta.capacidad} personas · {ETIQUETAS_ESTADO[mesaAbierta.estado]}
            {ordenDeMesa && ` · consumo ${pesos(consumo)}`}
          </p>

          <button className="btn primario grande" onClick={() => navegar(`/orden/${mesaAbierta.id}`)}>
            {mesaAbierta.estado === 'libre' ? 'Abrir mesa y tomar orden' : 'Ver / agregar a la orden'}
          </button>

          {ordenDeMesa && (
            <button className="btn grande" onClick={() => navegar(`/cobro/${ordenDeMesa.id}`)}>
              Cuenta y cobro
            </button>
          )}

          <div className="grupo-opciones">
            <h3>Cambiar estado</h3>
            <div className="opciones">
              {(Object.keys(ETIQUETAS_ESTADO) as EstadoMesa[])
                .filter((e) => e !== mesaAbierta.estado)
                .map((estado) => (
                  <button key={estado} className="opcion" onClick={() => cambiarEstado(mesaAbierta, estado)}>
                    {ETIQUETAS_ESTADO[estado]}
                  </button>
                ))}
            </div>
          </div>
        </Dialogo>
      )}
    </div>
  );
}
