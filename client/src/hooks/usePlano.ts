import { useCallback, useEffect, useState } from 'react';
import { api, ErrorApi } from '../api/cliente';
import type { Plano } from '../tipos';

/** Carga el plano del comedor. Una sola petición trae zonas, mesas y elementos. */
export function usePlano(layoutId?: number) {
  const [plano, setPlano] = useState<Plano | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      setPlano(await api.plano(layoutId));
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar el plano');
    } finally {
      setCargando(false);
    }
  }, [layoutId]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  return { plano, setPlano, cargando, error, setError, recargar };
}
