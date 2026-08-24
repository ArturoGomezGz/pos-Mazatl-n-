import { useRef } from 'react';
import type { PointerEvent as EventoPuntero } from 'react';
import { ETIQUETAS_ESTADO, geometriaLugar, type Barra, type Elemento, type Geometria, type Mesa, type Seleccion, type Zona } from '../tipos';

type Tipo = 'mesa' | 'elemento' | 'barra';
type Modo = 'mover' | 'redimensionar';

interface Props {
  zona: Zona;
  escala: number;
  /** Tamaño de la cuadrícula de ajuste. 0 = movimiento libre. */
  cuadricula: number;
  editable: boolean;
  /** En la vista de salón las mesas se pintan por estado; en el editor, no. */
  mostrarEstados: boolean;
  seleccion: Seleccion;
  onSeleccionar: (seleccion: Seleccion) => void;
  onGeometria: (tipo: Tipo, id: number, geometria: Geometria) => void;
  onAbrirMesa?: (mesa: Mesa) => void;
}

interface Arrastre {
  tipo: Tipo;
  id: number;
  modo: Modo;
  clienteX: number;
  clienteY: number;
  inicial: Geometria;
  movido: boolean;
}

const MINIMO = 40;

export function Lienzo({
  zona,
  escala,
  cuadricula,
  editable,
  mostrarEstados,
  seleccion,
  onSeleccionar,
  onGeometria,
  onAbrirMesa,
}: Props) {
  const arrastre = useRef<Arrastre | null>(null);

  const ajustar = (valor: number) => (cuadricula > 0 ? Math.round(valor / cuadricula) * cuadricula : Math.round(valor));
  const acotar = (valor: number, min: number, max: number) => Math.min(Math.max(valor, min), max);

  function iniciar(evento: EventoPuntero<HTMLElement>, tipo: Tipo, id: number, geometria: Geometria, modo: Modo) {
    onSeleccionar({ tipo, id });
    evento.preventDefault();
    evento.stopPropagation();
    evento.currentTarget.setPointerCapture(evento.pointerId);
    arrastre.current = { tipo, id, modo, clienteX: evento.clientX, clienteY: evento.clientY, inicial: geometria, movido: false };
  }

  function mover(evento: EventoPuntero<HTMLElement>) {
    const actual = arrastre.current;
    if (!actual) return;

    // Los deltas vienen en píxeles de pantalla; el lienzo puede estar a otra escala.
    const dx = (evento.clientX - actual.clienteX) / escala;
    const dy = (evento.clientY - actual.clienteY) / escala;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) actual.movido = true;

    const g = actual.inicial;
    const siguiente: Geometria =
      actual.modo === 'mover'
        ? {
            ...g,
            x: acotar(ajustar(g.x + dx), 0, Math.max(0, zona.ancho - g.ancho)),
            y: acotar(ajustar(g.y + dy), 0, Math.max(0, zona.alto - g.alto)),
          }
        : {
            ...g,
            ancho: acotar(ajustar(g.ancho + dx), MINIMO, zona.ancho - g.x),
            alto: acotar(ajustar(g.alto + dy), MINIMO, zona.alto - g.y),
          };

    onGeometria(actual.tipo, actual.id, siguiente);
  }

  function terminar(evento: EventoPuntero<HTMLElement>) {
    arrastre.current = null;
    if (evento.currentTarget.hasPointerCapture?.(evento.pointerId)) {
      evento.currentTarget.releasePointerCapture(evento.pointerId);
    }
  }

  // En modo lectura no interceptamos el puntero: el navegador necesita el gesto
  // para desplazar el plano, y un `click` distingue toque de arrastre sin ayuda.
  // Interceptarlo era lo que hacía que arrastrar abriera una mesa por error.
  const manejadores = editable
    ? { onPointerDown: undefined, onPointerMove: mover, onPointerUp: terminar, onPointerCancel: terminar }
    : {};

  return (
    <div className="lienzo-contenedor" onPointerDown={() => onSeleccionar(null)}>
      <div
        className={`lienzo${editable ? ' con-cuadricula' : ''}`}
        style={{
          width: zona.ancho,
          height: zona.alto,
          transform: `scale(${escala})`,
          // Reservamos el espacio que ocupa el lienzo escalado para que el scroll funcione.
          marginBottom: zona.alto * (escala - 1),
          marginRight: zona.ancho * (escala - 1),
        }}
      >
        {zona.elementos.map((elemento) => (
          <FiguraElemento
            key={elemento.id}
            elemento={elemento}
            editable={editable}
            seleccionado={seleccion?.tipo === 'elemento' && seleccion.id === elemento.id}
            onIniciar={iniciar}
            manejadores={manejadores}
          />
        ))}

        {zona.mesas
          .filter((mesa) => mesa.barraId == null)
          .map((mesa) => (
            <FiguraMesa
              key={mesa.id}
              mesa={mesa}
              editable={editable}
              mostrarEstado={mostrarEstados}
              seleccionada={seleccion?.tipo === 'mesa' && seleccion.id === mesa.id}
              onIniciar={iniciar}
              onAbrir={onAbrirMesa}
              manejadores={manejadores}
            />
          ))}

        {zona.barras.map((barra) => (
          <FiguraBarra
            key={barra.id}
            barra={barra}
            lugares={zona.mesas.filter((m) => m.barraId === barra.id).sort((a, b) => (a.numeroLugar ?? 0) - (b.numeroLugar ?? 0))}
            editable={editable}
            mostrarEstado={mostrarEstados}
            seleccionada={seleccion?.tipo === 'barra' && seleccion.id === barra.id}
            onIniciar={iniciar}
            onAbrir={onAbrirMesa}
            manejadores={manejadores}
          />
        ))}
      </div>
    </div>
  );
}

type Manejadores = Record<string, ((e: EventoPuntero<HTMLElement>) => void) | undefined>;
type Iniciar = (e: EventoPuntero<HTMLElement>, tipo: Tipo, id: number, g: Geometria, modo: Modo) => void;

function FiguraMesa({
  mesa,
  editable,
  mostrarEstado,
  seleccionada,
  onIniciar,
  onAbrir,
  manejadores,
}: {
  mesa: Mesa;
  editable: boolean;
  mostrarEstado: boolean;
  seleccionada: boolean;
  onIniciar: Iniciar;
  onAbrir?: (mesa: Mesa) => void;
  manejadores: Manejadores;
}) {
  const clases = [
    'figura',
    `forma-${mesa.forma}`,
    mesa.forma === 'redonda' ? 'redonda' : '',
    editable ? 'editable' : 'consulta',
    seleccionada ? 'seleccionada' : '',
    mesa.activa ? '' : 'inactiva',
    mostrarEstado ? `estado-${mesa.estado}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={clases}
      style={{
        left: mesa.x,
        top: mesa.y,
        width: mesa.ancho,
        height: mesa.alto,
        transform: mesa.rotacion ? `rotate(${mesa.rotacion}deg)` : undefined,
      }}
      {...manejadores}
      {...(editable
        ? { onPointerDown: (e: EventoPuntero<HTMLElement>) => onIniciar(e, 'mesa', mesa.id, geometriaDe(mesa), 'mover') }
        : { onClick: () => onAbrir?.(mesa), role: 'button', tabIndex: 0 })}
    >
      <span className="nombre">{mesa.nombre}</span>
      <span className="detalle">{mesa.capacidad}p</span>
      {mostrarEstado && <span className="estado">{ETIQUETAS_ESTADO[mesa.estado]}</span>}
      {editable && seleccionada && (
        <span
          className="manija"
          {...manejadores}
          onPointerDown={(e) => onIniciar(e, 'mesa', mesa.id, geometriaDe(mesa), 'redimensionar')}
        />
      )}
    </div>
  );
}

/** Una barra se coloca como un solo bloque, pero por dentro son mesas
 *  independientes: cada lugar tiene su propio estado y su propia orden, así
 *  que dos grupos de clientes pueden sentarse en la misma barra a la vez.
 *  En el editor se arrastra y redimensiona como un bloque; en la vista de
 *  salón cada lugar se toca por separado para abrirlo. */
function FiguraBarra({
  barra,
  lugares,
  editable,
  mostrarEstado,
  seleccionada,
  onIniciar,
  onAbrir,
  manejadores,
}: {
  barra: Barra;
  lugares: Mesa[];
  editable: boolean;
  mostrarEstado: boolean;
  seleccionada: boolean;
  onIniciar: Iniciar;
  onAbrir?: (mesa: Mesa) => void;
  manejadores: Manejadores;
}) {
  return (
    <div
      className={`figura barra${editable ? ' editable' : ' consulta'}${seleccionada ? ' seleccionada' : ''}${barra.activa ? '' : ' inactiva'}`}
      style={{
        left: barra.x,
        top: barra.y,
        width: barra.ancho,
        height: barra.alto,
        transform: barra.rotacion ? `rotate(${barra.rotacion}deg)` : undefined,
      }}
      {...manejadores}
      {...(editable ? { onPointerDown: (e: EventoPuntero<HTMLElement>) => onIniciar(e, 'barra', barra.id, geometriaDe(barra), 'mover') } : {})}
    >
      {lugares.map((lugar, i) => {
        const seg = geometriaLugar(barra, i, lugares.length);
        return (
          <div
            key={lugar.id}
            className={`lugar${mostrarEstado ? ` estado-${lugar.estado}` : ''}`}
            style={{ left: seg.x - barra.x, top: seg.y - barra.y, width: seg.ancho, height: seg.alto }}
            {...(!editable ? { onClick: () => onAbrir?.(lugar), role: 'button', tabIndex: 0 } : {})}
          >
            <span className="nombre">{lugar.numeroLugar}</span>
            {mostrarEstado && <span className="estado">{ETIQUETAS_ESTADO[lugar.estado]}</span>}
          </div>
        );
      })}
      {editable && seleccionada && (
        <span
          className="manija"
          {...manejadores}
          onPointerDown={(e) => onIniciar(e, 'barra', barra.id, geometriaDe(barra), 'redimensionar')}
        />
      )}
    </div>
  );
}

function FiguraElemento({
  elemento,
  editable,
  seleccionado,
  onIniciar,
  manejadores,
}: {
  elemento: Elemento;
  editable: boolean;
  seleccionado: boolean;
  onIniciar: Iniciar;
  manejadores: Manejadores;
}) {
  return (
    <div
      className={`elemento tipo-${elemento.tipo}${editable ? ' editable' : ' consulta'}${seleccionado ? ' seleccionado' : ''}`}
      style={{
        left: elemento.x,
        top: elemento.y,
        width: elemento.ancho,
        height: elemento.alto,
        transform: elemento.rotacion ? `rotate(${elemento.rotacion}deg)` : undefined,
      }}
      {...manejadores}
      {...(editable
        ? { onPointerDown: (e: EventoPuntero<HTMLElement>) => onIniciar(e, 'elemento', elemento.id, geometriaDe(elemento), 'mover') }
        : {})}
    >
      {elemento.etiqueta}
      {editable && seleccionado && (
        <span
          className="manija"
          {...manejadores}
          onPointerDown={(e) => onIniciar(e, 'elemento', elemento.id, geometriaDe(elemento), 'redimensionar')}
        />
      )}
    </div>
  );
}

const geometriaDe = (g: Geometria): Geometria => ({ x: g.x, y: g.y, ancho: g.ancho, alto: g.alto, rotacion: g.rotacion });
