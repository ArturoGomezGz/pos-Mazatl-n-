import { useCallback, useEffect, useState } from 'react';
import { api, ErrorApi } from '../api/cliente';
import { Dialogo } from '../componentes/Dialogo';
import { ETIQUETAS_ROL, type Rol, type Usuario } from '../tipos';

export function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [bitacora, setBitacora] = useState<{ id: number; accion: string; detalle: string; creadoEn: string; usuario: string | null }[]>([]);
  const [nuevo, setNuevo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const [u, b] = await Promise.all([api.usuarios(), api.bitacora()]);
    setUsuarios(u);
    setBitacora(b);
  }, []);

  useEffect(() => {
    cargar().catch((e) => setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar'));
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

  return (
    <div className="contenido">
      <div className="barra">
        <strong>Equipo</strong>
        <span className="empuje" />
        <button className="btn primario" onClick={() => setNuevo(true)}>+ Persona</button>
      </div>

      {error && <div className="aviso">{error}</div>}

      <div className="cuerpo bloques">
        <section className="bloque">
          <table className="tabla">
            <thead>
              <tr><th>Nombre</th><th>Rol</th><th>Estado</th><th /></tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className={u.activo ? '' : 'inactivo'}>
                  <td><strong>{u.nombre}</strong></td>
                  <td>
                    <select value={u.rol} onChange={(e) => accion(async () => { await api.actualizarUsuario(u.id, { rol: e.target.value as Rol }); })}>
                      {(Object.keys(ETIQUETAS_ROL) as Rol[]).map((r) => (
                        <option key={r} value={r}>{ETIQUETAS_ROL[r]}</option>
                      ))}
                    </select>
                  </td>
                  <td>{u.activo ? 'Activo' : 'Dado de baja'}</td>
                  <td>
                    <button
                      className="btn chico"
                      onClick={() => {
                        const pin = prompt(`Nuevo PIN para ${u.nombre} (4 a 6 dígitos):`)?.trim();
                        if (pin) void accion(async () => { await api.actualizarUsuario(u.id, { pin }); });
                      }}
                    >
                      Cambiar PIN
                    </button>
                    <button
                      className="btn chico peligro"
                      onClick={() => accion(async () => { await api.actualizarUsuario(u.id, { activo: !u.activo }); })}
                    >
                      {u.activo ? 'Dar de baja' : 'Reactivar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="tenue">
            Dar de baja no borra a la persona: sus ventas siguen en el historial. Es la única forma correcta de hacerlo.
          </p>
        </section>

        <section className="bloque">
          <h2>Bitácora</h2>
          <p className="tenue">Todo lo sensible queda registrado: cancelaciones, descuentos, cambios de precio, cortes.</p>
          <table className="tabla">
            <tbody>
              {bitacora.slice(0, 60).map((b) => (
                <tr key={b.id}>
                  <td className="tenue">{b.creadoEn}</td>
                  <td>{b.usuario ?? '—'}</td>
                  <td><strong>{b.accion}</strong></td>
                  <td>{b.detalle}</td>
                </tr>
              ))}
              {bitacora.length === 0 && <tr><td className="tenue">Sin movimientos todavía.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>

      {nuevo && <DialogoUsuario onCerrar={() => setNuevo(false)} onCrear={(d) => accion(async () => { await api.crearUsuario(d); setNuevo(false); })} />}
    </div>
  );
}

function DialogoUsuario({ onCerrar, onCrear }: { onCerrar: () => void; onCrear: (d: { nombre: string; rol: Rol; pin: string }) => void }) {
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<Rol>('mesero');
  const [pin, setPin] = useState('');

  return (
    <Dialogo titulo="Nueva persona" onCerrar={onCerrar} ancho={420}>
      <div className="campo">
        <label htmlFor="u-nombre">Nombre</label>
        <input id="u-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
      </div>
      <div className="campo">
        <label htmlFor="u-rol">Rol</label>
        <select id="u-rol" value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
          {(Object.keys(ETIQUETAS_ROL) as Rol[]).map((r) => <option key={r} value={r}>{ETIQUETAS_ROL[r]}</option>)}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="u-pin">PIN (4 a 6 dígitos)</label>
        <input id="u-pin" inputMode="numeric" value={pin} maxLength={6} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
      </div>
      <div className="acciones-dialogo">
        <button className="btn" onClick={onCerrar}>Cancelar</button>
        <button className="btn primario" disabled={!nombre.trim() || pin.length < 4} onClick={() => onCrear({ nombre: nombre.trim(), rol, pin })}>
          Crear
        </button>
      </div>
    </Dialogo>
  );
}
