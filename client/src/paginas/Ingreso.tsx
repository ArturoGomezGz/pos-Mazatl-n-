import { useEffect, useState } from 'react';
import { api, ErrorApi } from '../api/cliente';
import { TecladoNumerico } from '../componentes/TecladoNumerico';
import { useSesion } from '../estado/Sesion';
import { ETIQUETAS_ROL, type Usuario } from '../tipos';

/** Ingreso por PIN: nadie escribe contraseñas con las manos mojadas. */
export function Ingreso() {
  const { ingresar } = useSesion();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [elegido, setElegido] = useState<Usuario | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  useEffect(() => {
    api.usuariosActivos().then(setUsuarios).catch((e) => setError(e instanceof ErrorApi ? e.message : 'Error'));
  }, []);

  async function intentar(pinCompleto: string) {
    if (!elegido) return;
    setEntrando(true);
    try {
      await ingresar(elegido.id, pinCompleto);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo entrar');
      setPin('');
    } finally {
      setEntrando(false);
    }
  }

  function teclear(tecla: string) {
    setError(null);
    const siguiente = (pin + tecla).slice(0, 6);
    setPin(siguiente);
    if (siguiente.length === 4) void intentar(siguiente);
  }

  return (
    <div className="ingreso">
      <div className="ingreso-tarjeta">
        <h1>Mariscos Mazatlán</h1>

        {import.meta.env.VITE_MOCK === '1' && (
          <p className="ingreso-demo">
            Modo demo — sin servidor real. Elige a cualquiera del equipo para probar la aplicación.
          </p>
        )}

        {!elegido ? (
          <>
            <p className="ingreso-guia">¿Quién eres?</p>
            <div className="lista-usuarios">
              {usuarios.map((u) => (
                <button key={u.id} className="btn usuario" onClick={() => setElegido(u)}>
                  <strong>{u.nombre}</strong>
                  <span>{ETIQUETAS_ROL[u.rol]}</span>
                </button>
              ))}
              {usuarios.length === 0 && !error && <p className="ingreso-guia">Cargando…</p>}
            </div>
          </>
        ) : (
          <>
            <p className="ingreso-guia">
              Hola, <strong>{elegido.nombre}</strong>. Teclea tu PIN.
            </p>
            <div className="pin-puntos grande">{'•'.repeat(pin.length) || '····'}</div>
            <TecladoNumerico teclaExtra="" onTecla={teclear} onBorrar={() => setPin((p) => p.slice(0, -1))} />
            <button className="btn fantasma" onClick={() => { setElegido(null); setPin(''); setError(null); }}>
              ← Cambiar de usuario
            </button>
            {entrando && <p className="ingreso-guia">Entrando…</p>}
          </>
        )}

        {error && <div className="aviso">{error}</div>}
      </div>
    </div>
  );
}
