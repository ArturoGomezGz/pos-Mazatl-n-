import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ErrorApi } from '../api/cliente';
import { Dialogo } from '../componentes/Dialogo';
import { MenuVenta } from '../componentes/MenuVenta';
import { useSesion } from '../estado/Sesion';
import {
  AYUDA_TIPO_VENTA,
  ETIQUETAS_TIPO_VENTA,
  leerEstiloMenu,
  pesos,
  type Categoria,
  type Estacion,
  type GrupoModificador,
  type Modificador,
  type Producto,
  type TipoVenta,
} from '../tipos';

const COLORES = ['#13618c', '#e4572e', '#2e9e5b', '#f0a202', '#6b4fbb', '#0b3954'];

export function AdminMenu() {
  const { config } = useSesion();
  const estilo = leerEstiloMenu(config);
  const [menu, setMenu] = useState<Categoria[]>([]);
  const [grupos, setGrupos] = useState<GrupoModificador[]>([]);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [editando, setEditando] = useState<Producto | 'nuevo' | null>(null);
  const [gestionandoGrupos, setGestionandoGrupos] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const [m, g] = await Promise.all([api.menu(true), api.grupos()]);
    setMenu(m);
    setGrupos(g);
    setCategoriaId((previo) => previo ?? m[0]?.id ?? null);
  }, []);

  useEffect(() => {
    cargar().catch((e) => setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar el menú'));
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

  const categoria = menu.find((c) => c.id === categoriaId) ?? menu[0];

  return (
    <div className="contenido">
      {/* Editar el menú es trabajo de escritorio: tablas y formularios no caben
          bien en un teléfono. Ahí se cambia por una vista de solo consulta. */}
      <div className="aviso info editor-solo-escritorio">
        La edición del menú está pensada para computadora. En un teléfono puedes consultar el menú aquí abajo.
      </div>

      <div className="vista-escritorio">
        <div className="barra">
          <strong>Menú</strong>
          <span className="tenue">{menu.reduce((a, c) => a + c.productos.length, 0)} productos</span>
          <span className="empuje" />
          <button className="btn chico" onClick={() => setGestionandoGrupos(true)}>Modificadores</button>
          <button className="btn chico" onClick={() => accion(async () => { await api.reabrirDisponibilidad(); })}>
            Reabrir agotados del día
          </button>
          <button className="btn primario" disabled={!categoria} onClick={() => setEditando('nuevo')}>+ Producto</button>
        </div>

        {error && <div className="aviso">{error}</div>}

        <div className="cuerpo">
          <aside className="panel">
            <h2>Categorías</h2>
            {menu.map((c) => (
              <button
                key={c.id}
                className={`btn categoria${c.id === categoria?.id ? ' elegida' : ''}`}
                style={{ borderLeft: `6px solid ${c.color}` }}
                onClick={() => setCategoriaId(c.id)}
              >
                {c.nombre}
                <span className="tenue"> ({c.productos.length})</span>
              </button>
            ))}
            <button
              className="btn"
              onClick={() => {
                const nombre = prompt('Nombre de la categoría (ej. Botanas):')?.trim();
                if (nombre) void accion(async () => { await api.crearCategoria({ nombre }); });
              }}
            >
              + Categoría
            </button>

            {categoria && (
              <div className="grupo">
                <h2>Categoría {categoria.nombre}</h2>
                <div className="opciones">
                  {COLORES.map((color) => (
                    <button
                      key={color}
                      className={`muestra-color${categoria.color === color ? ' elegida' : ''}`}
                      style={{ background: color }}
                      aria-label={`Color ${color}`}
                      onClick={() => accion(async () => { await api.actualizarCategoria(categoria.id, { color }); })}
                    />
                  ))}
                </div>
                <button
                  className="btn"
                  onClick={() => {
                    const nombre = prompt('Nuevo nombre:', categoria.nombre)?.trim();
                    if (nombre) void accion(async () => { await api.actualizarCategoria(categoria.id, { nombre }); });
                  }}
                >
                  Renombrar
                </button>
                <button
                  className="btn peligro"
                  onClick={() => {
                    if (confirm(`¿Eliminar la categoría ${categoria.nombre}?`)) {
                      void accion(async () => { await api.eliminarCategoria(categoria.id); setCategoriaId(null); });
                    }
                  }}
                >
                  Eliminar categoría
                </button>
              </div>
            )}
          </aside>

          <div className="columna-tabla">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Estilo de venta</th>
                  <th>Precio</th>
                  <th>Estación</th>
                  <th>Hoy</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(categoria?.productos ?? []).map((p) => (
                  <tr key={p.id} className={p.activo ? '' : 'inactivo'}>
                    <td>
                      <strong>{p.nombre}</strong>
                      {p.descripcion && <div className="tenue">{p.descripcion}</div>}
                    </td>
                    <td>{ETIQUETAS_TIPO_VENTA[p.tipoVenta]}</td>
                    <td className="numero">
                      {p.tipoVenta === 'abierto'
                        ? 'del día'
                        : p.variantes.filter((v) => v.activa).map((v) => (
                            <div key={v.id}>
                              {p.tipoVenta === 'variantes' && <span className="tenue">{v.nombre}: </span>}
                              {pesos(v.precioCentavos)}
                              {p.tipoVenta === 'peso' && ' /kg'}
                            </div>
                          ))}
                    </td>
                    <td>{p.estacion === 'barra' ? 'Barra' : 'Cocina'}</td>
                    <td>
                      <button
                        className={`btn chico${p.disponibleHoy ? '' : ' peligro'}`}
                        onClick={() => accion(async () => { await api.disponibilidad(p.id, !p.disponibleHoy); })}
                      >
                        {p.disponibleHoy ? 'Disponible' : 'Agotado'}
                      </button>
                    </td>
                    <td>
                      <button className="btn chico" onClick={() => setEditando(p)}>Editar</button>
                    </td>
                  </tr>
                ))}
                {categoria && categoria.productos.length === 0 && (
                  <tr><td colSpan={6} className="tenue">Esta categoría no tiene productos todavía.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="vista-movil">
        <div className="barra compacta">
          <strong>Menú</strong>
          <span className="tenue">solo consulta</span>
        </div>
        <div className="columna-menu">
          <MenuVenta categorias={menu} estilo={estilo} onElegir={() => {}} />
        </div>
      </div>

      {editando && categoria && (
        <DialogoProductoAdmin
          producto={editando === 'nuevo' ? null : editando}
          categorias={menu}
          categoriaId={categoria.id}
          grupos={grupos}
          onCerrar={() => setEditando(null)}
          onGuardar={(datos, id) =>
            accion(async () => {
              if (id) await api.actualizarProducto(id, datos);
              else await api.crearProducto(datos);
              setEditando(null);
            })
          }
          onEliminar={(id) =>
            accion(async () => {
              await api.eliminarProducto(id);
              setEditando(null);
            })
          }
          onCambiarVariantes={() => cargar()}
        />
      )}

      {gestionandoGrupos && (
        <DialogoGrupos grupos={grupos} onCerrar={() => setGestionandoGrupos(false)} onCambio={() => cargar()} />
      )}
    </div>
  );
}

/* ── Alta y edición de producto ──────────────────────────────────────── */

function DialogoProductoAdmin({
  producto,
  categorias,
  categoriaId,
  grupos,
  onCerrar,
  onGuardar,
  onEliminar,
  onCambiarVariantes,
}: {
  producto: Producto | null;
  categorias: Categoria[];
  categoriaId: number;
  grupos: GrupoModificador[];
  onCerrar: () => void;
  onGuardar: (datos: Record<string, unknown>, id?: number) => void;
  onEliminar: (id: number) => void;
  onCambiarVariantes: () => void;
}) {
  const [nombre, setNombre] = useState(producto?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(producto?.descripcion ?? '');
  const [catId, setCatId] = useState(producto?.categoriaId ?? categoriaId);
  const [estacion, setEstacion] = useState<Estacion>(producto?.estacion ?? 'cocina');
  const [tipoVenta, setTipoVenta] = useState<TipoVenta>(producto?.tipoVenta ?? 'simple');
  const [precio, setPrecio] = useState(
    producto ? String((producto.variantes.find((v) => v.activa)?.precioCentavos ?? 0) / 100) : '',
  );
  const [variantes, setVariantes] = useState<{ nombre: string; precio: string }[]>(
    producto?.tipoVenta === 'variantes'
      ? producto.variantes.filter((v) => v.activa).map((v) => ({ nombre: v.nombre, precio: String(v.precioCentavos / 100) }))
      : [{ nombre: 'Orden', precio: '' }, { nombre: 'Media orden', precio: '' }],
  );
  const [elegidos, setElegidos] = useState<Set<number>>(new Set(producto?.grupos.map((g) => g.id) ?? []));

  const centavos = (texto: string) => Math.round(Number(texto || '0') * 100);

  const guardar = () => {
    const base = {
      categoriaId: catId,
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      estacion,
      tipoVenta,
      gruposIds: [...elegidos],
    };
    if (tipoVenta === 'variantes') {
      const lista = variantes
        .filter((v) => v.nombre.trim() && v.precio !== '')
        .map((v, i) => ({ nombre: v.nombre.trim(), precioCentavos: centavos(v.precio), orden: i }));
      if (producto) onGuardar(base, producto.id);
      else onGuardar({ ...base, variantes: lista, precioCentavos: 0 });
      return;
    }
    onGuardar({ ...base, precioCentavos: centavos(precio), variantes: [] }, producto?.id);
  };

  const listo = nombre.trim().length > 0 && (tipoVenta === 'variantes' ? variantes.some((v) => v.precio !== '') : precio !== '');

  return (
    <Dialogo titulo={producto ? `Editar ${producto.nombre}` : 'Nuevo producto'} onCerrar={onCerrar} ancho={620}>
      <div className="campo">
        <label htmlFor="p-nombre">Nombre</label>
        <input id="p-nombre" value={nombre} maxLength={60} onChange={(e) => setNombre(e.target.value)} autoFocus />
      </div>

      <div className="campo">
        <label htmlFor="p-desc">Descripción (opcional)</label>
        <input id="p-desc" value={descripcion} maxLength={200} onChange={(e) => setDescripcion(e.target.value)} />
      </div>

      <div className="campo-doble">
        <div className="campo">
          <label htmlFor="p-cat">Categoría</label>
          <select id="p-cat" value={catId} onChange={(e) => setCatId(Number(e.target.value))}>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="p-est">¿Dónde se prepara?</label>
          <select id="p-est" value={estacion} onChange={(e) => setEstacion(e.target.value as Estacion)}>
            <option value="cocina">Cocina</option>
            <option value="barra">Barra</option>
          </select>
        </div>
      </div>

      <div className="grupo-opciones">
        <h3>Estilo de venta</h3>
        <div className="opciones columna">
          {(Object.keys(ETIQUETAS_TIPO_VENTA) as TipoVenta[]).map((t) => (
            <button key={t} className={`opcion ancha${tipoVenta === t ? ' elegida' : ''}`} onClick={() => setTipoVenta(t)}>
              <strong>{ETIQUETAS_TIPO_VENTA[t]}</strong>
              <small>{AYUDA_TIPO_VENTA[t]}</small>
            </button>
          ))}
        </div>
      </div>

      {tipoVenta === 'variantes' ? (
        <div className="grupo-opciones">
          <h3>Tamaños y precios</h3>
          {producto ? (
            <VariantesExistentes producto={producto} onCambio={onCambiarVariantes} />
          ) : (
            <>
              {variantes.map((v, i) => (
                <div key={i} className="campo-doble">
                  <div className="campo">
                    <label>Nombre</label>
                    <input
                      value={v.nombre}
                      placeholder="Orden / Chico"
                      onChange={(e) => setVariantes((p) => p.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))}
                    />
                  </div>
                  <div className="campo">
                    <label>Precio</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={v.precio}
                      onChange={(e) => setVariantes((p) => p.map((x, j) => (j === i ? { ...x, precio: e.target.value } : x)))}
                    />
                  </div>
                </div>
              ))}
              <button className="btn chico" onClick={() => setVariantes((p) => [...p, { nombre: '', precio: '' }])}>
                + Otro tamaño
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="campo">
          <label htmlFor="p-precio">
            {tipoVenta === 'peso' ? 'Precio por kilo' : tipoVenta === 'abierto' ? 'Precio de referencia (se captura al vender)' : 'Precio'}
          </label>
          <input id="p-precio" type="number" min={0} step="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} />
        </div>
      )}

      <div className="grupo-opciones">
        <h3>Modificadores</h3>
        {grupos.length === 0 && <p className="tenue">Todavía no hay grupos de modificadores.</p>}
        <div className="opciones">
          {grupos.map((g) => (
            <button
              key={g.id}
              className={`opcion${elegidos.has(g.id) ? ' elegida' : ''}`}
              onClick={() =>
                setElegidos((previo) => {
                  const siguiente = new Set(previo);
                  if (siguiente.has(g.id)) siguiente.delete(g.id);
                  else siguiente.add(g.id);
                  return siguiente;
                })
              }
            >
              {g.nombre}
              <span>{g.modificadores.length} opciones</span>
            </button>
          ))}
        </div>
      </div>

      <div className="acciones-dialogo">
        {producto && (
          <button className="btn peligro" onClick={() => confirm(`¿Quitar ${producto.nombre} del menú?`) && onEliminar(producto.id)}>
            Quitar del menú
          </button>
        )}
        <button className="btn" onClick={onCerrar}>Cancelar</button>
        <button className="btn primario" disabled={!listo} onClick={guardar}>Guardar</button>
      </div>
    </Dialogo>
  );
}

/** Los tamaños de un producto existente se editan uno por uno, en vivo: así el
 *  dueño puede subir el precio del camarón sin tocar lo demás. */
function VariantesExistentes({ producto, onCambio }: { producto: Producto; onCambio: () => void }) {
  const [nuevo, setNuevo] = useState({ nombre: '', precio: '' });

  return (
    <>
      {producto.variantes.filter((v) => v.activa).map((v) => (
        <div key={v.id} className="campo-doble">
          <div className="campo">
            <label>Tamaño</label>
            <input
              defaultValue={v.nombre}
              onBlur={(e) => e.target.value !== v.nombre && api.actualizarVariante(v.id, { nombre: e.target.value }).then(onCambio)}
            />
          </div>
          <div className="campo">
            <label>Precio</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="number"
                step="0.01"
                defaultValue={v.precioCentavos / 100}
                onBlur={(e) =>
                  api.actualizarVariante(v.id, { precioCentavos: Math.round(Number(e.target.value) * 100) }).then(onCambio)
                }
              />
              <button className="btn chico peligro" onClick={() => api.eliminarVariante(v.id).then(onCambio).catch(() => {})}>
                ✕
              </button>
            </div>
          </div>
        </div>
      ))}
      <div className="campo-doble">
        <div className="campo">
          <label>Nuevo tamaño</label>
          <input value={nuevo.nombre} placeholder="Grande" onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
        </div>
        <div className="campo">
          <label>Precio</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="number" step="0.01" value={nuevo.precio} onChange={(e) => setNuevo({ ...nuevo, precio: e.target.value })} />
            <button
              className="btn chico"
              disabled={!nuevo.nombre.trim() || nuevo.precio === ''}
              onClick={() =>
                api
                  .agregarVariante(producto.id, { nombre: nuevo.nombre.trim(), precioCentavos: Math.round(Number(nuevo.precio) * 100) })
                  .then(() => {
                    setNuevo({ nombre: '', precio: '' });
                    onCambio();
                  })
              }
            >
              +
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Grupos de modificadores ─────────────────────────────────────────── */

/** Feedback de guardado. El dueño necesita ver que su cambio quedó; si el
 *  servidor lo rechaza, el error sube a la vista y el campo se revierte. */
function useGuardado(alFallar: (mensaje: string) => void) {
  const [estado, setEstado] = useState<'idle' | 'guardando' | 'guardado'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const ejecutar = useCallback(
    async (fn: () => Promise<unknown>) => {
      setEstado('guardando');
      try {
        await fn();
        setEstado('guardado');
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setEstado('idle'), 2000);
        return true;
      } catch (e) {
        setEstado('idle');
        alFallar(e instanceof ErrorApi ? e.message : 'No se pudo guardar el cambio');
        return false;
      }
    },
    [alFallar],
  );

  return { estado, ejecutar };
}

function MarcaGuardado({ estado }: { estado: 'idle' | 'guardando' | 'guardado' }) {
  if (estado === 'idle') return null;
  return (
    <span className={`marca-guardado${estado === 'guardado' ? ' ok' : ''}`}>
      {estado === 'guardando' ? 'Guardando…' : 'Guardado ✓'}
    </span>
  );
}

const clampNum = (n: number, lo: number, hi: number) => Math.min(Math.max(Number.isFinite(n) ? n : lo, lo), hi);

function resumenGrupo(g: GrupoModificador) {
  const n = g.modificadores.length;
  const rango =
    g.minSelecciones === 0 && g.maxSelecciones === 1
      ? 'opcional, elige uno'
      : g.minSelecciones === g.maxSelecciones
        ? `elige exactamente ${g.minSelecciones}`
        : g.minSelecciones === 0
          ? `opcional, hasta ${g.maxSelecciones}`
          : `elige de ${g.minSelecciones} a ${g.maxSelecciones}`;
  return `${rango} · ${n} ${n === 1 ? 'opción' : 'opciones'}`;
}

function textoLimites(min: number, max: number) {
  if (min === 0 && max === 1) return 'El mesero puede elegir una opción o ninguna.';
  if (min === 0) return `El mesero puede elegir hasta ${max} opciones, o ninguna.`;
  if (min === max) return `El mesero debe elegir exactamente ${min} ${min === 1 ? 'opción' : 'opciones'}.`;
  return `El mesero debe elegir entre ${min} y ${max} opciones.`;
}

/** Lista de grupos (colapsada) + editor de uno a la vez. Separa "ver qué grupos
 *  tengo" de "editar este grupo", que antes vivían en un solo formulario plano. */
function DialogoGrupos({ grupos, onCerrar, onCambio }: { grupos: GrupoModificador[]; onCerrar: () => void; onCambio: () => void }) {
  const [creando, setCreando] = useState(false);
  const [expandido, setExpandido] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialogo titulo="Grupos de modificadores" onCerrar={onCerrar} ancho={620}>
      <p className="detalle-dialogo">
        Un grupo se reutiliza entre productos: “Término” sirve para todos los filetes. Elige un grupo para editarlo.
      </p>

      {error && <div className="aviso">{error}</div>}

      <div className="barra-grupos">
        <span className="tenue">{grupos.length} {grupos.length === 1 ? 'grupo' : 'grupos'}</span>
        <button className="btn chico primario" onClick={() => { setCreando(true); setExpandido(null); setError(null); }}>
          + Nuevo grupo
        </button>
      </div>

      {creando && (
        <GrupoNuevo
          alFallar={setError}
          onCancelar={() => setCreando(false)}
          onCreado={(id) => { setCreando(false); setError(null); setExpandido(id); onCambio(); }}
        />
      )}

      {grupos.length === 0 && !creando && (
        <p className="tenue">Todavía no hay grupos. Crea el primero con “+ Nuevo grupo”.</p>
      )}

      <ul className="lista-grupos">
        {grupos.map((g) => (
          <li key={g.id} className={`grupo-fila${expandido === g.id ? ' abierta' : ''}`}>
            <button
              className="grupo-fila__cabecera"
              onClick={() => { setExpandido((p) => (p === g.id ? null : g.id)); setError(null); }}
            >
              <span className="grupo-fila__nombre">{g.nombre}</span>
              <span className="grupo-fila__resumen">{resumenGrupo(g)}</span>
              <span className="grupo-fila__accion">{expandido === g.id ? 'Cerrar' : 'Editar'}</span>
            </button>
            {expandido === g.id && (
              <div className="grupo-fila__cuerpo">
                <GrupoEditor
                  grupo={g}
                  alFallar={setError}
                  onCambio={onCambio}
                  onEliminado={() => { setExpandido(null); setError(null); onCambio(); }}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </Dialogo>
  );
}

/** Alta rápida: solo el nombre y dos preguntas de sí/no. El ajuste fino de
 *  mín/máx vive en el editor, que se abre en cuanto se crea. */
function GrupoNuevo({
  alFallar,
  onCancelar,
  onCreado,
}: {
  alFallar: (m: string) => void;
  onCancelar: () => void;
  onCreado: (id: number) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [obligatorio, setObligatorio] = useState(false);
  const [varias, setVarias] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const crear = async () => {
    setGuardando(true);
    const minSelecciones = obligatorio ? 1 : 0;
    const maxSelecciones = varias ? 10 : 1;
    try {
      const g = await api.crearGrupo({ nombre: nombre.trim(), minSelecciones, maxSelecciones, modificadores: [] });
      onCreado(g.id);
    } catch (e) {
      alFallar(e instanceof ErrorApi ? e.message : 'No se pudo crear el grupo');
      setGuardando(false);
    }
  };

  return (
    <div className="grupo-fila abierta">
      <div className="grupo-fila__cuerpo">
        <div className="campo">
          <label htmlFor="g-nombre">Nombre del grupo</label>
          <input
            id="g-nombre"
            value={nombre}
            autoFocus
            maxLength={40}
            placeholder="Término, Extras, Sin ingrediente"
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>
        <label className="campo-check">
          <input type="checkbox" checked={obligatorio} onChange={(e) => setObligatorio(e.target.checked)} />
          El mesero está obligado a elegir una opción
        </label>
        <label className="campo-check">
          <input type="checkbox" checked={varias} onChange={(e) => setVarias(e.target.checked)} />
          Puede elegir varias opciones a la vez
        </label>
        <div className="acciones-dialogo">
          <button className="btn chico" onClick={onCancelar}>Cancelar</button>
          <button className="btn chico primario" disabled={!nombre.trim() || guardando} onClick={crear}>
            {guardando ? 'Creando…' : 'Crear grupo'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Editor de un grupo. Campos controlados en local, sincronizados con lo que
 *  responde el servidor: si un guardado falla, el campo vuelve solo. */
function GrupoEditor({
  grupo,
  alFallar,
  onCambio,
  onEliminado,
}: {
  grupo: GrupoModificador;
  alFallar: (m: string) => void;
  onCambio: () => void;
  onEliminado: () => void;
}) {
  const { estado, ejecutar } = useGuardado(alFallar);
  const [nombre, setNombre] = useState(grupo.nombre);
  const [min, setMin] = useState(grupo.minSelecciones);
  const [max, setMax] = useState(grupo.maxSelecciones);
  const [nueva, setNueva] = useState({ nombre: '', precio: '' });

  useEffect(() => {
    setNombre(grupo.nombre);
    setMin(grupo.minSelecciones);
    setMax(grupo.maxSelecciones);
  }, [grupo.nombre, grupo.minSelecciones, grupo.maxSelecciones]);

  const centavos = (t: string) => Math.round(Number(t || '0') * 100);

  async function aplicar(cambios: Parameters<typeof api.actualizarGrupo>[1]) {
    const ok = await ejecutar(() => api.actualizarGrupo(grupo.id, cambios));
    if (ok) onCambio();
    else {
      setNombre(grupo.nombre);
      setMin(grupo.minSelecciones);
      setMax(grupo.maxSelecciones);
    }
  }

  function guardarNombre() {
    const v = nombre.trim();
    if (!v) return setNombre(grupo.nombre);
    if (v !== grupo.nombre) aplicar({ nombre: v });
  }

  /** min ≤ max siempre: al subir el mínimo se arrastra el máximo, y viceversa. */
  function commitLimites(m: number, x: number) {
    setMin(m);
    setMax(x);
    if (m !== grupo.minSelecciones || x !== grupo.maxSelecciones) {
      aplicar({ minSelecciones: m, maxSelecciones: x });
    }
  }
  function guardarMin(raw: number) {
    const m = clampNum(raw, 0, 10);
    commitLimites(m, Math.max(m, max));
  }
  function guardarMax(raw: number) {
    const x = clampNum(raw, 1, 10);
    commitLimites(Math.min(min, x), x);
  }

  const eliminar = () => {
    if (!confirm(`¿Eliminar el grupo “${grupo.nombre}”? Se quitará de los productos que lo usan.`)) return;
    api
      .eliminarGrupo(grupo.id)
      .then(onEliminado)
      .catch((e) => alFallar(e instanceof ErrorApi ? e.message : 'No se pudo eliminar el grupo'));
  };

  return (
    <>
      <div className="campo">
        <label>Nombre del grupo <MarcaGuardado estado={estado} /></label>
        <input value={nombre} maxLength={40} onChange={(e) => setNombre(e.target.value)} onBlur={guardarNombre} />
      </div>

      <div className="campo-doble">
        <div className="campo">
          <label>Mínimo a elegir</label>
          <input
            type="number"
            min={0}
            max={10}
            inputMode="numeric"
            value={min}
            onChange={(e) => setMin(e.target.value === '' ? 0 : Number(e.target.value))}
            onBlur={(e) => guardarMin(Number(e.target.value))}
          />
        </div>
        <div className="campo">
          <label>Máximo a elegir</label>
          <input
            type="number"
            min={1}
            max={10}
            inputMode="numeric"
            value={max}
            onChange={(e) => setMax(e.target.value === '' ? 1 : Number(e.target.value))}
            onBlur={(e) => guardarMax(Number(e.target.value))}
          />
        </div>
      </div>
      <p className="ayuda-limites">{textoLimites(min, max)}</p>

      <div className="opcion-lista">
        {grupo.modificadores.length === 0 && (
          <p className="tenue">Este grupo aún no tiene opciones. Agrega al menos una abajo.</p>
        )}
        {grupo.modificadores.map((m: Modificador) => (
          <OpcionFila key={m.id} opcion={m} alFallar={alFallar} onCambio={onCambio} />
        ))}
      </div>

      <div className="opcion-fila nueva">
        <input
          className="opcion-fila__nombre"
          value={nueva.nombre}
          placeholder="Nueva opción (ej. Sin cebolla)"
          maxLength={40}
          onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })}
        />
        <div className="opcion-fila__precio">
          <span className="prefijo">+$</span>
          <input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            placeholder="0"
            value={nueva.precio}
            onChange={(e) => setNueva({ ...nueva, precio: e.target.value })}
          />
        </div>
        <button
          className="btn chico"
          disabled={!nueva.nombre.trim()}
          onClick={() =>
            api
              .crearModificador({ grupoId: grupo.id, nombre: nueva.nombre.trim(), precioExtraCentavos: centavos(nueva.precio) })
              .then(() => {
                setNueva({ nombre: '', precio: '' });
                onCambio();
              })
              .catch((e) => alFallar(e instanceof ErrorApi ? e.message : 'No se pudo agregar la opción'))
          }
        >
          Agregar
        </button>
      </div>

      <div className="grupo-editor__pie">
        <button className="enlace-peligro" onClick={eliminar}>Eliminar grupo</button>
      </div>
    </>
  );
}

/** Una opción del grupo: nombre y precio extra, guardado al salir del campo con
 *  su propio indicador. */
function OpcionFila({ opcion, alFallar, onCambio }: { opcion: Modificador; alFallar: (m: string) => void; onCambio: () => void }) {
  const { estado, ejecutar } = useGuardado(alFallar);
  const [nombre, setNombre] = useState(opcion.nombre);
  const [precio, setPrecio] = useState(String(opcion.precioExtraCentavos / 100));

  useEffect(() => {
    setNombre(opcion.nombre);
    setPrecio(String(opcion.precioExtraCentavos / 100));
  }, [opcion.nombre, opcion.precioExtraCentavos]);

  async function aplicar(cambios: Parameters<typeof api.actualizarModificador>[1]) {
    const ok = await ejecutar(() => api.actualizarModificador(opcion.id, cambios));
    if (ok) onCambio();
    else {
      setNombre(opcion.nombre);
      setPrecio(String(opcion.precioExtraCentavos / 100));
    }
  }

  return (
    <div className="opcion-fila">
      <input
        className="opcion-fila__nombre"
        value={nombre}
        maxLength={40}
        onChange={(e) => setNombre(e.target.value)}
        onBlur={() => {
          const v = nombre.trim();
          if (!v) return setNombre(opcion.nombre);
          if (v !== opcion.nombre) aplicar({ nombre: v });
        }}
      />
      <div className="opcion-fila__precio">
        <span className="prefijo">+$</span>
        <input
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          onBlur={() => {
            const c = Math.round(Number(precio || '0') * 100);
            if (c !== opcion.precioExtraCentavos) aplicar({ precioExtraCentavos: c });
          }}
        />
      </div>
      <MarcaGuardado estado={estado} />
      <button
        className="btn fantasma opcion-fila__quitar"
        aria-label={`Quitar ${opcion.nombre}`}
        onClick={() =>
          api
            .eliminarModificador(opcion.id)
            .then(onCambio)
            .catch((e) => alFallar(e instanceof ErrorApi ? e.message : 'No se pudo quitar la opción'))
        }
      >
        ✕
      </button>
    </div>
  );
}
