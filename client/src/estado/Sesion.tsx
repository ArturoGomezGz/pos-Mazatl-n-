import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, configurarPerdidaDeSesion, sesionGuardada } from '../api/cliente';
import type { Config, Rol, Usuario } from '../tipos';

interface EstadoSesion {
  usuario: Usuario | null;
  config: Config;
  cargando: boolean;
  ingresar: (usuarioId: number, pin: string) => Promise<void>;
  salir: () => Promise<void>;
  recargarConfig: () => Promise<void>;
  puede: (...roles: Rol[]) => boolean;
}

const Contexto = createContext<EstadoSesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [config, setConfig] = useState<Config>({});
  const [cargando, setCargando] = useState(true);
  const navegar = useNavigate();

  const recargarConfig = useCallback(async () => {
    setConfig(await api.config());
  }, []);

  // Al abrir la app se intenta reanudar la sesión guardada: el mesero no debería
  // volver a teclear su PIN porque se recargó la pantalla.
  useEffect(() => {
    configurarPerdidaDeSesion(() => setUsuario(null));
    (async () => {
      if (!sesionGuardada.leer()) {
        setCargando(false);
        return;
      }
      try {
        setUsuario(await api.yo());
        await recargarConfig();
      } catch {
        sesionGuardada.borrar();
      } finally {
        setCargando(false);
      }
    })();
  }, [recargarConfig]);

  const valor = useMemo<EstadoSesion>(
    () => ({
      usuario,
      config,
      cargando,
      ingresar: async (usuarioId, pin) => {
        const { token, usuario: entrante } = await api.ingresar(usuarioId, pin);
        sesionGuardada.guardar(token);
        setUsuario(entrante);
        await recargarConfig();
        // Arranca siempre desde el inicio: evita que quede visible, aunque sea
        // un instante, la última vista del usuario anterior.
        navegar('/', { replace: true });
      },
      salir: async () => {
        try {
          await api.salir();
        } finally {
          sesionGuardada.borrar();
          setUsuario(null);
          navegar('/', { replace: true });
        }
      },
      recargarConfig,
      puede: (...roles) => Boolean(usuario && roles.includes(usuario.rol)),
    }),
    [usuario, config, cargando, recargarConfig, navegar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion() {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useSesion debe usarse dentro de ProveedorSesion');
  return contexto;
}
