import {
  ETIQUETAS_ELEMENTO,
  ETIQUETAS_FORMA,
  type Barra,
  type Elemento,
  type FormaMesa,
  type Mesa,
  type TipoElemento,
  type Zona,
} from '../tipos';

interface Props {
  mesa?: Mesa;
  barra?: Barra;
  elemento?: Elemento;
  zonas: Zona[];
  onCambiarMesa: (id: number, cambios: Partial<Mesa>) => void;
  onCambiarBarra: (id: number, cambios: Partial<Barra>) => void;
  onCambiarElemento: (id: number, cambios: Partial<Elemento>) => void;
  onDuplicar: () => void;
  onEliminar: () => void;
}

export function PanelPropiedades({ mesa, barra, elemento, zonas, onCambiarMesa, onCambiarBarra, onCambiarElemento, onDuplicar, onEliminar }: Props) {
  if (!mesa && !barra && !elemento) {
    return (
      <aside className="panel derecho">
        <h2>Propiedades</h2>
        <p style={{ color: 'var(--tinta-suave)', fontSize: 14, lineHeight: 1.5 }}>
          Toca una mesa, una barra o un elemento del plano para editarlo.
        </p>
        <p style={{ color: 'var(--tinta-suave)', fontSize: 13, lineHeight: 1.5 }}>
          Arrastra para mover. Con algo seleccionado, las flechas del teclado lo mueven y <b>Supr</b> lo elimina.
        </p>
      </aside>
    );
  }

  if (barra) {
    const cambiar = (cambios: Partial<Barra>) => onCambiarBarra(barra.id, cambios);
    return (
      <aside className="panel derecho">
        <h2>Barra B-{barra.numero}</h2>

        <div className="campo">
          <label htmlFor="barra-lugares">Lugares</label>
          <input
            id="barra-lugares"
            type="number"
            min={1}
            max={30}
            value={barra.lugares}
            onChange={(e) => cambiar({ lugares: entero(e.target.value, 1, 30, barra.lugares) })}
          />
          <p style={{ fontSize: 12, color: 'var(--tinta-suave)', margin: 0 }}>
            Cada lugar es una mesa independiente: se numeran B-{barra.numero}-1, B-{barra.numero}-2… y pueden
            atender a grupos distintos al mismo tiempo. Si reduces los lugares y alguno tiene una cuenta abierta,
            no se podrá quitar hasta cerrarla.
          </p>
        </div>

        <div className="campo">
          <label htmlFor="barra-zona">Zona</label>
          <select id="barra-zona" value={barra.zonaId} onChange={(e) => cambiar({ zonaId: Number(e.target.value) })}>
            {zonas.map((z) => (
              <option key={z.id} value={z.id}>{z.nombre}</option>
            ))}
          </select>
        </div>

        <Geometria valor={barra} onCambio={(g) => cambiar(g)} />

        <div className="campo">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44 }}>
            <input type="checkbox" checked={barra.activa} onChange={(e) => cambiar({ activa: e.target.checked })} />
            Barra en uso
          </label>
          <p style={{ fontSize: 12, color: 'var(--tinta-suave)', margin: 0 }}>
            Desactívala en temporada baja: deja de aparecer en el piso, pero conserva su historial.
          </p>
        </div>

        <button className="btn" onClick={onDuplicar}>Duplicar barra</button>
        <button className="btn peligro" onClick={onEliminar}>Eliminar barra</button>
      </aside>
    );
  }

  if (mesa) {
    const cambiar = (cambios: Partial<Mesa>) => onCambiarMesa(mesa.id, cambios);
    return (
      <aside className="panel derecho">
        <h2>Mesa {mesa.nombre}</h2>

        <div className="campo">
          <label htmlFor="mesa-nombre">Nombre</label>
          <input id="mesa-nombre" value={mesa.nombre} maxLength={20} onChange={(e) => cambiar({ nombre: e.target.value })} />
        </div>

        <div className="campo-doble">
          <div className="campo">
            <label htmlFor="mesa-capacidad">Capacidad</label>
            <input
              id="mesa-capacidad"
              type="number"
              min={1}
              max={30}
              value={mesa.capacidad}
              onChange={(e) => cambiar({ capacidad: entero(e.target.value, 1, 30, mesa.capacidad) })}
            />
          </div>
          <div className="campo">
            <label htmlFor="mesa-forma">Forma</label>
            <select id="mesa-forma" value={mesa.forma} onChange={(e) => cambiar({ forma: e.target.value as FormaMesa })}>
              {Object.entries(ETIQUETAS_FORMA).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>{etiqueta}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="campo">
          <label htmlFor="mesa-zona">Zona</label>
          <select id="mesa-zona" value={mesa.zonaId} onChange={(e) => cambiar({ zonaId: Number(e.target.value) })}>
            {zonas.map((z) => (
              <option key={z.id} value={z.id}>{z.nombre}</option>
            ))}
          </select>
        </div>

        <Geometria valor={mesa} onCambio={(g) => cambiar(g)} />

        <div className="campo">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44 }}>
            <input type="checkbox" checked={mesa.activa} onChange={(e) => cambiar({ activa: e.target.checked })} />
            Mesa en uso
          </label>
          <p style={{ fontSize: 12, color: 'var(--tinta-suave)', margin: 0 }}>
            Desactívala en temporada baja: deja de aparecer en el piso, pero conserva su historial.
          </p>
        </div>

        <button className="btn" onClick={onDuplicar}>Duplicar mesa</button>
        <button className="btn peligro" onClick={onEliminar}>Eliminar mesa</button>
      </aside>
    );
  }

  const el = elemento!;
  const cambiar = (cambios: Partial<Elemento>) => onCambiarElemento(el.id, cambios);
  return (
    <aside className="panel derecho">
      <h2>{ETIQUETAS_ELEMENTO[el.tipo]}</h2>

      <div className="campo">
        <label htmlFor="el-tipo">Tipo</label>
        <select id="el-tipo" value={el.tipo} onChange={(e) => cambiar({ tipo: e.target.value as TipoElemento })}>
          {Object.entries(ETIQUETAS_ELEMENTO).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>{etiqueta}</option>
          ))}
        </select>
      </div>

      <div className="campo">
        <label htmlFor="el-etiqueta">Etiqueta</label>
        <input id="el-etiqueta" value={el.etiqueta} maxLength={40} onChange={(e) => cambiar({ etiqueta: e.target.value })} />
      </div>

      <div className="campo">
        <label htmlFor="el-zona">Zona</label>
        <select id="el-zona" value={el.zonaId} onChange={(e) => cambiar({ zonaId: Number(e.target.value) })}>
          {zonas.map((z) => (
            <option key={z.id} value={z.id}>{z.nombre}</option>
          ))}
        </select>
      </div>

      <Geometria valor={el} onCambio={(g) => cambiar(g)} />

      <button className="btn" onClick={onDuplicar}>Duplicar elemento</button>
      <button className="btn peligro" onClick={onEliminar}>Eliminar elemento</button>
    </aside>
  );
}

/** Campos numéricos de posición y tamaño. Existen para poder alinear con
 *  precisión y como respaldo si el arrastre falla en una tablet vieja. */
function Geometria({
  valor,
  onCambio,
}: {
  valor: { x: number; y: number; ancho: number; alto: number; rotacion: number };
  onCambio: (g: Partial<{ x: number; y: number; ancho: number; alto: number; rotacion: number }>) => void;
}) {
  return (
    <>
      <div className="campo-doble">
        <div className="campo">
          <label htmlFor="geo-x">X</label>
          <input id="geo-x" type="number" value={valor.x} onChange={(e) => onCambio({ x: entero(e.target.value, -10000, 10000, valor.x) })} />
        </div>
        <div className="campo">
          <label htmlFor="geo-y">Y</label>
          <input id="geo-y" type="number" value={valor.y} onChange={(e) => onCambio({ y: entero(e.target.value, -10000, 10000, valor.y) })} />
        </div>
      </div>
      <div className="campo-doble">
        <div className="campo">
          <label htmlFor="geo-ancho">Ancho</label>
          <input id="geo-ancho" type="number" value={valor.ancho} onChange={(e) => onCambio({ ancho: entero(e.target.value, 20, 4000, valor.ancho) })} />
        </div>
        <div className="campo">
          <label htmlFor="geo-alto">Alto</label>
          <input id="geo-alto" type="number" value={valor.alto} onChange={(e) => onCambio({ alto: entero(e.target.value, 20, 4000, valor.alto) })} />
        </div>
      </div>
      <div className="campo">
        <label htmlFor="geo-rot">Rotación (grados)</label>
        <input id="geo-rot" type="number" min={0} max={359} value={valor.rotacion} onChange={(e) => onCambio({ rotacion: entero(e.target.value, 0, 359, valor.rotacion) })} />
      </div>
    </>
  );
}

function entero(crudo: string, min: number, max: number, previo: number) {
  const n = Number.parseInt(crudo, 10);
  if (Number.isNaN(n)) return previo;
  return Math.min(Math.max(n, min), max);
}
