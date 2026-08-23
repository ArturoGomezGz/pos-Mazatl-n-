import { useState } from 'react';
import { pesos, type Categoria, type EstiloMenu, type Producto } from '../tipos';

interface Props {
  categorias: Categoria[];
  estilo: EstiloMenu;
  onElegir: (producto: Producto) => void;
  /** Permite marcar agotado desde la misma pantalla de venta. */
  onAlternarDisponibilidad?: (producto: Producto) => void;
}

/** La pantalla de venta. Su forma la decide la configuración del restaurante,
 *  no el código: cuadrícula o lista, con o sin precios, colores por categoría,
 *  botones cómodos o grandes. Un menú de 12 productos y uno de 200 necesitan
 *  cosas distintas. */
export function MenuVenta({ categorias, estilo, onElegir, onAlternarDisponibilidad }: Props) {
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const activa = categorias.find((c) => c.id === categoriaId) ?? categorias[0];

  if (categorias.length === 0) {
    return <div className="vacio">Todavía no hay menú. El administrador puede crearlo en “Menú”.</div>;
  }

  const visibles = (activa?.productos ?? []).filter(
    (p) => estilo.agotados !== 'ocultar' || p.disponibleHoy,
  );

  return (
    <div className="menu-venta">
      <div className="pestanas categorias">
        {categorias.map((c) => (
          <button
            key={c.id}
            className={`pestana${c.id === activa?.id ? ' activa' : ''}`}
            style={estilo.colorPorCategoria && c.id === activa?.id ? { background: c.color, borderColor: c.color } : undefined}
            onClick={() => setCategoriaId(c.id)}
          >
            {c.nombre}
          </button>
        ))}
      </div>

      <div
        className={`rejilla-productos vista-${estilo.vista} boton-${estilo.tamanoBoton}`}
        style={estilo.vista === 'cuadricula' ? { gridTemplateColumns: `repeat(${estilo.columnas}, minmax(0, 1fr))` } : undefined}
      >
        {visibles.map((producto) => (
          <BotonProducto
            key={producto.id}
            producto={producto}
            color={estilo.colorPorCategoria ? activa?.color : undefined}
            estilo={estilo}
            onElegir={onElegir}
            onAlternarDisponibilidad={onAlternarDisponibilidad}
          />
        ))}
        {visibles.length === 0 && <div className="vacio">Esta categoría no tiene productos disponibles.</div>}
      </div>
    </div>
  );
}

function BotonProducto({
  producto,
  color,
  estilo,
  onElegir,
  onAlternarDisponibilidad,
}: {
  producto: Producto;
  color?: string;
  estilo: EstiloMenu;
  onElegir: (p: Producto) => void;
  onAlternarDisponibilidad?: (p: Producto) => void;
}) {
  const agotado = !producto.disponibleHoy;
  const precios = producto.variantes.filter((v) => v.activa);
  const desde = precios.length ? Math.min(...precios.map((v) => v.precioCentavos)) : 0;

  const etiquetaPrecio = () => {
    if (producto.tipoVenta === 'abierto') return 'Precio del día';
    if (producto.tipoVenta === 'peso') return `${pesos(desde)} / kg`;
    if (producto.tipoVenta === 'variantes' && precios.length > 1) return `Desde ${pesos(desde)}`;
    return pesos(desde);
  };

  return (
    <div
      className={`producto${agotado ? ' agotado' : ''}${onAlternarDisponibilidad ? ' con-agotar' : ''}`}
      style={color ? { borderTopColor: color } : undefined}
    >
      <button className="producto-principal" disabled={agotado} onClick={() => onElegir(producto)}>
        <span className="producto-nombre">{producto.nombre}</span>
        {estilo.mostrarDescripcion && producto.descripcion && (
          <span className="producto-descripcion">{producto.descripcion}</span>
        )}
        {estilo.mostrarPrecios && <span className="producto-precio">{etiquetaPrecio()}</span>}
        {agotado && <span className="sello-agotado">Agotado</span>}
      </button>

      {onAlternarDisponibilidad && (
        <button
          className="producto-agotar"
          title={agotado ? 'Marcar como disponible' : 'Marcar como agotado'}
          onClick={() => onAlternarDisponibilidad(producto)}
        >
          {agotado ? '↺' : '⊘'}
        </button>
      )}
    </div>
  );
}
