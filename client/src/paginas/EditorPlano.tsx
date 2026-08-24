import { useEffect, useMemo, useState } from 'react';
import { api, ErrorApi } from '../api/cliente';
import { Lienzo } from '../componentes/Lienzo';
import { PanelPropiedades } from '../componentes/PanelPropiedades';
import { usePlano } from '../hooks/usePlano';
import { ETIQUETAS_ESTADO, type Barra, type Elemento, type EstadoMesa, type Geometria, type Mesa, type Seleccion, type TipoElemento, type Zona } from '../tipos';

const CUADRICULA = 20;
const PASO_TECLADO = 20;

type Clave = string; // "mesa:12" | "elemento:3" | "barra:1"
const clave = (tipo: 'mesa' | 'elemento' | 'barra', id: number): Clave => `${tipo}:${id}`;

export function EditorPlano() {
  const [layoutId, setLayoutId] = useState<number | undefined>(undefined);
  const { plano, setPlano, cargando, error, setError, recargar } = usePlano(layoutId);

  const [zonaId, setZonaId] = useState<number | null>(null);
  const [seleccion, setSeleccion] = useState<Seleccion>(null);
  const [escala, setEscala] = useState(1);
  const [ajustar, setAjustar] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // Cambios pendientes de guardar. Separamos geometría (se guarda por lote en una
  // sola petición) de atributos (se guardan uno por uno, pero son pocos).
  const [geoSucias, setGeoSucias] = useState<Set<Clave>>(new Set());
  const [attrSucios, setAttrSucios] = useState<Map<Clave, Record<string, unknown>>>(new Map());
  const haycambios = geoSucias.size > 0 || attrSucios.size > 0;

  const zonas = plano?.zonas ?? [];
  const zona = useMemo(() => zonas.find((z) => z.id === zonaId) ?? zonas[0], [zonas, zonaId]);
  const mesaSel = seleccion?.tipo === 'mesa' ? zona?.mesas.find((m) => m.id === seleccion.id) : undefined;
  const elementoSel = seleccion?.tipo === 'elemento' ? zona?.elementos.find((e) => e.id === seleccion.id) : undefined;
  const barraSel = seleccion?.tipo === 'barra' ? zona?.barras.find((b) => b.id === seleccion.id) : undefined;

  useEffect(() => {
    if (zona && zona.id !== zonaId) setZonaId(zona.id);
  }, [zona, zonaId]);

  /* ── Edición local ───────────────────────────────────────────────────── */

  function editarMesa(id: number, cambios: Partial<Mesa>, soloGeometria = false) {
    setPlano((previo) => (previo ? aplicar(previo, 'mesa', id, cambios) : previo));
    marcarSucio('mesa', id, cambios, soloGeometria);
  }

  function editarElemento(id: number, cambios: Partial<Elemento>, soloGeometria = false) {
    setPlano((previo) => (previo ? aplicar(previo, 'elemento', id, cambios) : previo));
    marcarSucio('elemento', id, cambios, soloGeometria);
  }

  function editarBarra(id: number, cambios: Partial<Barra>, soloGeometria = false) {
    setPlano((previo) => (previo ? aplicar(previo, 'barra', id, cambios) : previo));
    marcarSucio('barra', id, cambios, soloGeometria);
  }

  function marcarSucio(tipo: 'mesa' | 'elemento' | 'barra', id: number, cambios: Record<string, unknown>, soloGeometria: boolean) {
    const k = clave(tipo, id);
    const camposGeo = ['x', 'y', 'ancho', 'alto', 'rotacion'];
    const tieneGeo = soloGeometria || Object.keys(cambios).some((c) => camposGeo.includes(c));
    const atributos = Object.fromEntries(Object.entries(cambios).filter(([c]) => !camposGeo.includes(c)));

    if (tieneGeo) setGeoSucias((s) => new Set(s).add(k));
    if (Object.keys(atributos).length) {
      setAttrSucios((m) => new Map(m).set(k, { ...(m.get(k) ?? {}), ...atributos }));
    }
  }

  function moverDesdeLienzo(tipo: 'mesa' | 'elemento' | 'barra', id: number, g: Geometria) {
    if (tipo === 'mesa') editarMesa(id, g, true);
    else if (tipo === 'barra') editarBarra(id, g, true);
    else editarElemento(id, g, true);
  }

  /* ── Alta de mesas, barras y elementos ─────────────────────────────────── */

  async function agregarMesa(capacidad: number, forma: Mesa['forma'], ancho: number, alto: number) {
    if (!zona || !plano) return;
    await accion(async () => {
      const creada = await api.crearMesa(
        {
          zonaId: zona.id,
          nombre: siguienteNombre(zona),
          capacidad,
          forma,
          ancho,
          alto,
          ...puntoLibre(zona),
        },
        plano.layout.id,
      );
      await recargar();
      setSeleccion({ tipo: 'mesa', id: creada.id });
    });
  }

  async function agregarBarra(lugares: number, ancho: number, alto: number) {
    if (!zona || !plano) return;
    await accion(async () => {
      const creada = await api.crearBarra({ zonaId: zona.id, lugares, ancho, alto, ...puntoLibre(zona) }, plano.layout.id);
      await recargar();
      setSeleccion({ tipo: 'barra', id: creada.id });
    });
  }

  async function agregarElemento(tipo: TipoElemento) {
    if (!zona || !plano) return;
    await accion(async () => {
      const creado = await api.crearElemento(
        { zonaId: zona.id, tipo, etiqueta: etiquetaPorTipo(tipo), ancho: 180, alto: 80, ...puntoLibre(zona) },
        plano.layout.id,
      );
      await recargar();
      setSeleccion({ tipo: 'elemento', id: creado.id });
    });
  }

  async function duplicar() {
    if (!zona || !plano) return;
    await accion(async () => {
      if (mesaSel) {
        const copia = await api.crearMesa(
          {
            zonaId: mesaSel.zonaId,
            nombre: siguienteNombre(zona),
            capacidad: mesaSel.capacidad,
            forma: mesaSel.forma,
            ancho: mesaSel.ancho,
            alto: mesaSel.alto,
            x: Math.min(mesaSel.x + CUADRICULA * 2, zona.ancho - mesaSel.ancho),
            y: Math.min(mesaSel.y + CUADRICULA * 2, zona.alto - mesaSel.alto),
          },
          plano.layout.id,
        );
        await recargar();
        setSeleccion({ tipo: 'mesa', id: copia.id });
      } else if (barraSel) {
        const copia = await api.crearBarra(
          {
            zonaId: barraSel.zonaId,
            lugares: barraSel.lugares,
            ancho: barraSel.ancho,
            alto: barraSel.alto,
            x: Math.min(barraSel.x + CUADRICULA * 2, zona.ancho - barraSel.ancho),
            y: Math.min(barraSel.y + CUADRICULA * 2, zona.alto - barraSel.alto),
          },
          plano.layout.id,
        );
        await recargar();
        setSeleccion({ tipo: 'barra', id: copia.id });
      } else if (elementoSel) {
        const copia = await api.crearElemento(
          {
            zonaId: elementoSel.zonaId,
            tipo: elementoSel.tipo,
            etiqueta: elementoSel.etiqueta,
            ancho: elementoSel.ancho,
            alto: elementoSel.alto,
            x: Math.min(elementoSel.x + CUADRICULA * 2, zona.ancho - elementoSel.ancho),
            y: Math.min(elementoSel.y + CUADRICULA * 2, zona.alto - elementoSel.alto),
          },
          plano.layout.id,
        );
        await recargar();
        setSeleccion({ tipo: 'elemento', id: copia.id });
      }
    });
  }

  async function eliminarSeleccion() {
    if (!seleccion) return;
    const que = mesaSel ? `la mesa ${mesaSel.nombre}` : barraSel ? `la barra B-${barraSel.numero} (${barraSel.lugares} lugares)` : 'este elemento';
    if (!confirm(`¿Eliminar ${que}? Esta acción no se puede deshacer.`)) return;
    await accion(async () => {
      if (seleccion.tipo === 'mesa') await api.eliminarMesa(seleccion.id);
      else if (seleccion.tipo === 'barra') await api.eliminarBarra(seleccion.id);
      else await api.eliminarElemento(seleccion.id);
      setSeleccion(null);
      await recargar();
    });
  }

  /* ── Zonas y distribuciones ──────────────────────────────────────────── */

  async function agregarZona() {
    const nombre = prompt('Nombre de la zona (ej. Terraza, Palapa):')?.trim();
    if (!nombre) return;
    await accion(async () => {
      const creada = await api.crearZona({ nombre });
      await recargar();
      setZonaId(creada.id);
    });
  }

  async function renombrarZona() {
    if (!zona) return;
    const nombre = prompt('Nuevo nombre de la zona:', zona.nombre)?.trim();
    if (!nombre || nombre === zona.nombre) return;
    await accion(async () => {
      await api.actualizarZona(zona.id, { nombre });
      await recargar();
    });
  }

  async function eliminarZona() {
    if (!zona) return;
    if (!confirm(`¿Eliminar la zona ${zona.nombre}?`)) return;
    await accion(async () => {
      await api.eliminarZona(zona.id);
      setZonaId(null);
      await recargar();
    });
  }

  async function agregarLayout() {
    const nombre = prompt('Nombre de la nueva distribución (ej. Temporada alta):')?.trim();
    if (!nombre || !plano) return;
    await accion(async () => {
      const creada = await api.crearLayout(nombre, plano.layout.id);
      setLayoutId(creada.id);
    });
  }

  /** Cuando todavía no existe ninguna distribución (comedor recién dado de alta)
   *  no hay `plano` del cual partir: se crea una distribución vacía sin copiar nada. */
  async function crearPrimerLayout() {
    await accion(async () => {
      const creada = await api.crearLayout('Comedor');
      await api.activarLayout(creada.id);
      setLayoutId(creada.id);
    });
  }

  async function activarLayout() {
    if (!plano || plano.layout.activo) return;
    await accion(async () => {
      await api.activarLayout(plano.layout.id);
      await recargar();
    });
  }

  /* ── Guardado ────────────────────────────────────────────────────────── */

  async function guardar() {
    if (!plano || !haycambios) return;
    setGuardando(true);
    try {
      const mesas = [...geoSucias]
        .filter((k) => k.startsWith('mesa:'))
        .map((k) => buscarMesa(plano, Number(k.split(':')[1])))
        .filter((m): m is Mesa => Boolean(m))
        .map((m) => ({ id: m.id, x: m.x, y: m.y, ancho: m.ancho, alto: m.alto, rotacion: m.rotacion }));

      const elementos = [...geoSucias]
        .filter((k) => k.startsWith('elemento:'))
        .map((k) => buscarElemento(plano, Number(k.split(':')[1])))
        .filter((e): e is Elemento => Boolean(e))
        .map((e) => ({ id: e.id, x: e.x, y: e.y, ancho: e.ancho, alto: e.alto, rotacion: e.rotacion }));

      const barras = [...geoSucias]
        .filter((k) => k.startsWith('barra:'))
        .map((k) => buscarBarra(plano, Number(k.split(':')[1])))
        .filter((b): b is Barra => Boolean(b))
        .map((b) => ({ id: b.id, x: b.x, y: b.y, ancho: b.ancho, alto: b.alto, rotacion: b.rotacion }));

      if (mesas.length || elementos.length || barras.length) {
        await api.guardarPosiciones(plano.layout.id, { mesas, elementos, barras });
      }

      for (const [k, cambios] of attrSucios) {
        const [tipo, crudo] = k.split(':');
        const id = Number(crudo);
        if (tipo === 'mesa') await api.actualizarMesa(id, cambios as Partial<Mesa>, plano.layout.id);
        else if (tipo === 'barra') await api.actualizarBarra(id, cambios as Partial<Barra>, plano.layout.id);
        else await api.actualizarElemento(id, cambios as Partial<Elemento>);
      }

      setGeoSucias(new Set());
      setAttrSucios(new Map());
      setError(null);
      await recargar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudieron guardar los cambios');
    } finally {
      setGuardando(false);
    }
  }

  async function descartar() {
    if (!confirm('¿Descartar los cambios sin guardar?')) return;
    setGeoSucias(new Set());
    setAttrSucios(new Map());
    await recargar();
  }

  async function accion(fn: () => Promise<void>) {
    try {
      await fn();
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'Ocurrió un error');
    }
  }

  /* ── Teclado ─────────────────────────────────────────────────────────── */

  useEffect(() => {
    function alPresionar(evento: KeyboardEvent) {
      const destino = evento.target as HTMLElement | null;
      if (destino && ['INPUT', 'SELECT', 'TEXTAREA'].includes(destino.tagName)) return;
      if (!seleccion) return;

      const actual: Mesa | Elemento | Barra | undefined = mesaSel ?? barraSel ?? elementoSel;
      if (!actual) return;

      const desplazamientos: Record<string, [number, number]> = {
        ArrowUp: [0, -PASO_TECLADO],
        ArrowDown: [0, PASO_TECLADO],
        ArrowLeft: [-PASO_TECLADO, 0],
        ArrowRight: [PASO_TECLADO, 0],
      };
      const delta = desplazamientos[evento.key];
      if (delta && zona) {
        evento.preventDefault();
        const g = {
          x: Math.min(Math.max(actual.x + delta[0], 0), zona.ancho - actual.ancho),
          y: Math.min(Math.max(actual.y + delta[1], 0), zona.alto - actual.alto),
        };
        if (seleccion.tipo === 'mesa') editarMesa(seleccion.id, g, true);
        else if (seleccion.tipo === 'barra') editarBarra(seleccion.id, g, true);
        else editarElemento(seleccion.id, g, true);
        return;
      }
      if (evento.key === 'Escape') setSeleccion(null);
      if (evento.key === 'Delete' || evento.key === 'Backspace') {
        evento.preventDefault();
        void eliminarSeleccion();
      }
    }
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  });

  /* ── Aviso al salir con cambios sin guardar ──────────────────────────── */

  useEffect(() => {
    if (!haycambios) return;
    const alSalir = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', alSalir);
    return () => window.removeEventListener('beforeunload', alSalir);
  }, [haycambios]);

  if (cargando && !plano) return <div className="cargando">Cargando el comedor…</div>;
  if (!plano) {
    return (
      <div className="contenido">
        <div className="vacio">
          Todavía no existe ninguna distribución del comedor.
          <div style={{ marginTop: 20 }}>
            <button className="btn primario" onClick={crearPrimerLayout}>Crear la primera distribución</button>
          </div>
        </div>
      </div>
    );
  }

  const zonaConsulta = zona ? { ...zona, mesas: zona.mesas.filter((m) => m.activa), barras: zona.barras.filter((b) => b.activa) } : undefined;

  return (
    <div className="contenido">
      {/* Diseñar el comedor es trabajo de escritorio: se hace una vez, con calma
          y con ratón. En un teléfono se cambia por una vista de solo consulta,
          para ubicar mesas y zonas sin poder moverlas. */}
      <div className="aviso info editor-solo-escritorio">
        El editor del comedor está pensado para computadora. En un teléfono puedes consultar el plano aquí abajo.
      </div>

      <div className="vista-escritorio">
        <div className="barra">
        <label>
          Distribución
          <select
            value={plano.layout.id}
            onChange={(e) => {
              setSeleccion(null);
              setLayoutId(Number(e.target.value));
            }}
          >
            {plano.layouts.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}{l.activo ? ' · en uso' : ''}
              </option>
            ))}
          </select>
        </label>
        <button className="btn chico" onClick={agregarLayout}>Nueva distribución</button>
        <button className="btn chico" onClick={activarLayout} disabled={plano.layout.activo}>
          {plano.layout.activo ? 'En uso' : 'Poner en uso'}
        </button>

        <span className="separador" />

        <label>
          <input type="checkbox" checked={ajustar} onChange={(e) => setAjustar(e.target.checked)} />
          Ajustar a cuadrícula
        </label>

        <span className="separador" />

        <button className="btn chico" onClick={() => setEscala((v) => Math.max(0.5, Number((v - 0.1).toFixed(2))))}>−</button>
        <span style={{ minWidth: 52, textAlign: 'center', fontWeight: 700 }}>{Math.round(escala * 100)}%</span>
        <button className="btn chico" onClick={() => setEscala((v) => Math.min(1.5, Number((v + 0.1).toFixed(2))))}>+</button>

        <span className="empuje" />

        {haycambios && <span className="marcador-sucio">Cambios sin guardar</span>}
        {haycambios && <button className="btn chico" onClick={descartar}>Descartar</button>}
        <button className="btn primario" onClick={guardar} disabled={!haycambios || guardando}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>

      <div className="pestanas">
        {zonas.map((z) => (
          <button
            key={z.id}
            className={`pestana${z.id === zona?.id ? ' activa' : ''}`}
            onClick={() => {
              setSeleccion(null);
              setZonaId(z.id);
            }}
          >
            {z.nombre} <span style={{ opacity: 0.7, fontWeight: 500 }}>({z.mesas.length})</span>
          </button>
        ))}
        <button className="pestana" onClick={agregarZona}>+ Zona</button>
      </div>

      {error && <div className="aviso">{error}</div>}

      <div className="cuerpo">
        <aside className="panel">
          <div className="grupo">
            <h2>Agregar mesa</h2>
            <button className="btn" onClick={() => agregarMesa(2, 'cuadrada', 90, 90)}>Mesa de 2</button>
            <button className="btn" onClick={() => agregarMesa(4, 'cuadrada', 110, 110)}>Mesa de 4</button>
            <button className="btn" onClick={() => agregarMesa(6, 'redonda', 150, 150)}>Mesa de 6 redonda</button>
            <button className="btn" onClick={() => agregarMesa(8, 'rectangular', 240, 120)}>Mesa de 8 larga</button>
            <button className="btn" onClick={() => agregarBarra(4, 280, 70)}>Barra (4 lugares)</button>
          </div>

          <div className="grupo">
            <h2>Agregar referencia</h2>
            <button className="btn" onClick={() => agregarElemento('barra')}>Barra</button>
            <button className="btn" onClick={() => agregarElemento('cocina')}>Cocina</button>
            <button className="btn" onClick={() => agregarElemento('bano')}>Baños</button>
            <button className="btn" onClick={() => agregarElemento('muro')}>Muro</button>
            <button className="btn" onClick={() => agregarElemento('planta')}>Planta</button>
            <button className="btn" onClick={() => agregarElemento('texto')}>Texto</button>
          </div>

          <div className="grupo">
            <h2>Zona {zona?.nombre}</h2>
            <button className="btn" onClick={renombrarZona}>Renombrar zona</button>
            <button className="btn peligro" onClick={eliminarZona}>Eliminar zona</button>
          </div>
        </aside>

        {zona ? (
          <Lienzo
            zona={zona}
            escala={escala}
            cuadricula={ajustar ? CUADRICULA : 0}
            editable
            mostrarEstados={false}
            seleccion={seleccion}
            onSeleccionar={setSeleccion}
            onGeometria={moverDesdeLienzo}
          />
        ) : (
          <div className="vacio">Todavía no hay zonas. Crea la primera con “+ Zona”.</div>
        )}

        <PanelPropiedades
          mesa={mesaSel}
          barra={barraSel}
          elemento={elementoSel}
          zonas={zonas}
          onCambiarMesa={editarMesa}
          onCambiarBarra={editarBarra}
          onCambiarElemento={editarElemento}
          onDuplicar={duplicar}
          onEliminar={eliminarSeleccion}
        />
      </div>
      </div>

      <div className="vista-movil">
        <div className="barra compacta">
          <strong>Comedor</strong>
          <span className="tenue">solo consulta</span>
        </div>

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

        <div className="cuerpo">
          {zonaConsulta ? (
            <Lienzo
              zona={zonaConsulta}
              escala={1}
              cuadricula={0}
              editable={false}
              mostrarEstados
              seleccion={null}
              onSeleccionar={() => {}}
              onGeometria={() => {}}
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
    </div>
  );
}

/* ── Utilidades ────────────────────────────────────────────────────────── */

function aplicar(plano: import('../tipos').Plano, tipo: 'mesa' | 'elemento' | 'barra', id: number, cambios: Record<string, unknown>) {
  return {
    ...plano,
    zonas: plano.zonas.map((z) => ({
      ...z,
      mesas: tipo === 'mesa' ? z.mesas.map((m) => (m.id === id ? { ...m, ...cambios } : m)) : z.mesas,
      barras: tipo === 'barra' ? z.barras.map((b) => (b.id === id ? { ...b, ...cambios } : b)) : z.barras,
      elementos: tipo === 'elemento' ? z.elementos.map((e) => (e.id === id ? { ...e, ...cambios } : e)) : z.elementos,
    })),
  };
}

const buscarMesa = (plano: import('../tipos').Plano, id: number) =>
  plano.zonas.flatMap((z) => z.mesas).find((m) => m.id === id);

const buscarBarra = (plano: import('../tipos').Plano, id: number) =>
  plano.zonas.flatMap((z) => z.barras).find((b) => b.id === id);

const buscarElemento = (plano: import('../tipos').Plano, id: number) =>
  plano.zonas.flatMap((z) => z.elementos).find((e) => e.id === id);

/** Sugiere el siguiente nombre libre a partir de la inicial de la zona: T-1, T-2… */
function siguienteNombre(zona: Zona): string {
  const prefijo = (zona.nombre.trim()[0] ?? 'M').toUpperCase();
  const usados = new Set(zona.mesas.map((m) => m.nombre));
  for (let n = 1; n < 500; n++) {
    const candidato = `${prefijo}-${n}`;
    if (!usados.has(candidato)) return candidato;
  }
  return `${prefijo}-${Date.now() % 1000}`;
}

/** Coloca lo nuevo en cascada para que no caiga siempre encima de lo anterior. */
function puntoLibre(zona: Zona) {
  const ocupados = zona.mesas.length + zona.elementos.length;
  return {
    x: Math.min(40 + (ocupados % 8) * CUADRICULA, Math.max(0, zona.ancho - 200)),
    y: Math.min(40 + (ocupados % 8) * CUADRICULA, Math.max(0, zona.alto - 200)),
  };
}

const etiquetaPorTipo = (tipo: TipoElemento) =>
  ({ barra: 'Barra', cocina: 'Cocina', bano: 'Baños', muro: '', planta: '', texto: 'Texto' })[tipo] ?? '';
