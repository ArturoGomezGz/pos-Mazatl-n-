import { useMemo, useState } from 'react';
import { pesos, type Producto, type Variante } from '../tipos';
import { Dialogo } from './Dialogo';
import { TecladoNumerico } from './TecladoNumerico';

export interface LineaCapturada {
  varianteId: number;
  cantidadMilesimas: number;
  nota: string;
  modificadoresIds: number[];
  precioCentavos?: number;
}

interface Props {
  producto: Producto;
  onCancelar: () => void;
  onAgregar: (linea: LineaCapturada) => void;
}

/** Un solo diálogo cubre los cuatro estilos de venta: precio único, tamaños,
 *  por peso y precio del día. El mesero ve solo lo que ese producto necesita. */
export function DialogoProducto({ producto, onCancelar, onAgregar }: Props) {
  const disponibles = producto.variantes.filter((v) => v.activa);
  const [variante, setVariante] = useState<Variante | undefined>(disponibles[0]);
  const [cantidad, setCantidad] = useState(1);
  const [pesoTexto, setPesoTexto] = useState('');       // gramos tecleados
  const [precioTexto, setPrecioTexto] = useState('');   // centavos tecleados
  const [nota, setNota] = useState('');
  const [elegidos, setElegidos] = useState<Set<number>>(new Set());

  const esPeso = producto.tipoVenta === 'peso';
  const esAbierto = producto.tipoVenta === 'abierto';

  const cantidadMilesimas = esPeso ? Number(pesoTexto || '0') : cantidad * 1000;
  const precioBase = esAbierto ? Number(precioTexto || '0') : variante?.precioCentavos ?? 0;

  const extras = useMemo(
    () =>
      producto.grupos
        .flatMap((g) => g.modificadores)
        .filter((m) => elegidos.has(m.id))
        .reduce((a, m) => a + m.precioExtraCentavos, 0),
    [producto.grupos, elegidos],
  );

  const total = Math.round(((precioBase + extras) * cantidadMilesimas) / 1000);

  const faltantes = producto.grupos.filter(
    (g) => g.modificadores.filter((m) => elegidos.has(m.id)).length < g.minSelecciones,
  );
  const listo = Boolean(variante) && cantidadMilesimas > 0 && (!esAbierto || precioBase > 0) && faltantes.length === 0;

  function alternar(grupoId: number, modificadorId: number, max: number) {
    setElegidos((previo) => {
      const siguiente = new Set(previo);
      if (siguiente.has(modificadorId)) {
        siguiente.delete(modificadorId);
        return siguiente;
      }
      const grupo = producto.grupos.find((g) => g.id === grupoId);
      const suyos = grupo?.modificadores.filter((m) => siguiente.has(m.id)) ?? [];
      // Si el grupo admite una sola opción (término, por ejemplo), se reemplaza.
      if (max === 1) suyos.forEach((m) => siguiente.delete(m.id));
      else if (suyos.length >= max) return previo;
      siguiente.add(modificadorId);
      return siguiente;
    });
  }

  return (
    <Dialogo titulo={producto.nombre} onCerrar={onCancelar} ancho={560}>
      {producto.descripcion && <p className="detalle-dialogo">{producto.descripcion}</p>}

      {producto.tipoVenta === 'variantes' && disponibles.length > 1 && (
        <div className="grupo-opciones">
          <h3>Tamaño</h3>
          <div className="opciones">
            {disponibles.map((v) => (
              <button
                key={v.id}
                className={`opcion${variante?.id === v.id ? ' elegida' : ''}`}
                onClick={() => setVariante(v)}
              >
                {v.nombre}
                <span>{pesos(v.precioCentavos)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {esAbierto && (
        <div className="grupo-opciones">
          <h3>Precio del día</h3>
          <div className="monto-grande">{pesos(precioBase)}</div>
          <TecladoNumerico
            onTecla={(t) => setPrecioTexto((p) => (p + t).replace(/^0+/, '').slice(0, 8))}
            onBorrar={() => setPrecioTexto((p) => p.slice(0, -1))}
          />
        </div>
      )}

      {esPeso && (
        <div className="grupo-opciones">
          <h3>Peso</h3>
          <div className="monto-grande">
            {(cantidadMilesimas / 1000).toFixed(3)} kg · {pesos(total)}
          </div>
          <p className="detalle-dialogo">Teclea el peso en gramos. 1250 = 1.250 kg</p>
          <TecladoNumerico
            onTecla={(t) => setPesoTexto((p) => (p + t).replace(/^0+/, '').slice(0, 6))}
            onBorrar={() => setPesoTexto((p) => p.slice(0, -1))}
          />
        </div>
      )}

      {!esPeso && (
        <div className="grupo-opciones">
          <h3>Cantidad</h3>
          <div className="contador">
            <button className="btn" onClick={() => setCantidad((c) => Math.max(1, c - 1))}>−</button>
            <span className="contador-valor">{cantidad}</span>
            <button className="btn" onClick={() => setCantidad((c) => Math.min(99, c + 1))}>+</button>
          </div>
        </div>
      )}

      {producto.grupos.map((grupo) => (
        <div key={grupo.id} className="grupo-opciones">
          <h3>
            {grupo.nombre}
            {grupo.minSelecciones > 0 && <span className="obligatorio"> · obligatorio</span>}
          </h3>
          <div className="opciones">
            {grupo.modificadores.filter((m) => m.activo).map((m) => (
              <button
                key={m.id}
                className={`opcion${elegidos.has(m.id) ? ' elegida' : ''}`}
                onClick={() => alternar(grupo.id, m.id, grupo.maxSelecciones)}
              >
                {m.nombre}
                {m.precioExtraCentavos > 0 && <span>+{pesos(m.precioExtraCentavos)}</span>}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="campo">
        <label htmlFor="nota-linea">Nota para la cocina</label>
        <input
          id="nota-linea"
          value={nota}
          maxLength={120}
          placeholder="Ej. sin sal, para la niña"
          onChange={(e) => setNota(e.target.value)}
        />
      </div>

      {/* Decir por qué está bloqueado el botón, en vez de dejarlo gris sin explicación. */}
      {faltantes.length > 0 && (
        <p className="aviso-suave">Falta elegir: {faltantes.map((g) => g.nombre).join(', ')}</p>
      )}
      {esAbierto && precioBase <= 0 && <p className="aviso-suave">Captura el precio del día.</p>}
      {esPeso && cantidadMilesimas <= 0 && <p className="aviso-suave">Captura el peso en gramos.</p>}

      <div className="acciones-dialogo">
        <span className="total-dialogo">{pesos(total)}</span>
        <button className="btn" onClick={onCancelar}>Cancelar</button>
        <button
          className="btn primario"
          disabled={!listo}
          onClick={() =>
            onAgregar({
              varianteId: variante!.id,
              cantidadMilesimas,
              nota: nota.trim(),
              modificadoresIds: [...elegidos],
              ...(esAbierto ? { precioCentavos: precioBase } : {}),
            })
          }
        >
          Agregar
        </button>
      </div>
    </Dialogo>
  );
}
