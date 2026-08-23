import { useCallback, useEffect, useState } from 'react';
import { api, ErrorApi } from '../api/cliente';
import { Dialogo } from '../componentes/Dialogo';
import {
  AYUDA_TIPO_VENTA,
  ETIQUETAS_TIPO_VENTA,
  pesos,
  type Categoria,
  type Estacion,
  type GrupoModificador,
  type Producto,
  type TipoVenta,
} from '../tipos';

const COLORES = ['#13618c', '#e4572e', '#2e9e5b', '#f0a202', '#6b4fbb', '#0b3954'];

export function AdminMenu() {
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

function DialogoGrupos({ grupos, onCerrar, onCambio }: { grupos: GrupoModificador[]; onCerrar: () => void; onCambio: () => void }) {
  const [nombre, setNombre] = useState('');
  const [min, setMin] = useState(0);
  const [max, setMax] = useState(1);

  return (
    <Dialogo titulo="Grupos de modificadores" onCerrar={onCerrar} ancho={620}>
      <p className="detalle-dialogo">
        Un grupo se reutiliza entre productos: “Término” sirve para todos los filetes. Con mínimo 1 el mesero está obligado a elegir.
      </p>

      {grupos.map((g) => (
        <div key={g.id} className="grupo-opciones">
          <h3>
            {g.nombre} <span className="tenue">· elige de {g.minSelecciones} a {g.maxSelecciones}</span>
            <button className="btn chico peligro" onClick={() => api.eliminarGrupo(g.id).then(onCambio)}>Eliminar</button>
          </h3>
          <div className="opciones">
            {g.modificadores.map((m) => (
              <span key={m.id} className="etiqueta">
                {m.nombre}
                {m.precioExtraCentavos > 0 && ` +${pesos(m.precioExtraCentavos)}`}
                <button className="enlace" onClick={() => api.eliminarModificador(m.id).then(onCambio)}>✕</button>
              </span>
            ))}
            <button
              className="btn chico"
              onClick={() => {
                const n = prompt('Nombre de la opción (ej. Sin cebolla):')?.trim();
                if (!n) return;
                const extra = prompt('¿Cuesta extra? Monto en pesos (0 si no):', '0') ?? '0';
                void api
                  .crearModificador({ grupoId: g.id, nombre: n, precioExtraCentavos: Math.round(Number(extra) * 100) })
                  .then(onCambio);
              }}
            >
              + Opción
            </button>
          </div>
        </div>
      ))}

      <div className="grupo-opciones">
        <h3>Nuevo grupo</h3>
        <div className="campo">
          <label htmlFor="g-nombre">Nombre</label>
          <input id="g-nombre" value={nombre} placeholder="Término, Extras, Sin ingrediente" onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="campo-doble">
          <div className="campo">
            <label htmlFor="g-min">Mínimo a elegir</label>
            <input id="g-min" type="number" min={0} max={10} value={min} onChange={(e) => setMin(Number(e.target.value))} />
          </div>
          <div className="campo">
            <label htmlFor="g-max">Máximo a elegir</label>
            <input id="g-max" type="number" min={1} max={10} value={max} onChange={(e) => setMax(Number(e.target.value))} />
          </div>
        </div>
        <button
          className="btn primario"
          disabled={!nombre.trim()}
          onClick={() =>
            api
              .crearGrupo({ nombre: nombre.trim(), minSelecciones: min, maxSelecciones: Math.max(max, min), modificadores: [] })
              .then(() => {
                setNombre('');
                onCambio();
              })
          }
        >
          Crear grupo
        </button>
      </div>
    </Dialogo>
  );
}
