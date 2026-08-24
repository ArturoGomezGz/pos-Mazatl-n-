import { useEffect, type ReactNode } from 'react';

interface Props {
  titulo: string;
  children: ReactNode;
  onCerrar: () => void;
  ancho?: number;
  /** Acciones que se quedan fijas al pie, fuera del área con scroll. */
  pie?: ReactNode;
}

/** Diálogo simple. Se cierra con Escape y tocando fuera: en una tablet, cerrar
 *  tiene que ser tan fácil como abrir. El cuerpo hace scroll si no cabe; el
 *  pie (si lo hay) se queda siempre visible para que las acciones nunca se corten. */
export function Dialogo({ titulo, children, onCerrar, ancho = 520, pie }: Props) {
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [onCerrar]);

  return (
    <div className="velo" onClick={onCerrar}>
      <div className="dialogo" style={{ maxWidth: ancho }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={titulo}>
        <header className="dialogo-encabezado">
          <h2>{titulo}</h2>
          <button className="btn fantasma" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </header>
        <div className="dialogo-cuerpo">{children}</div>
        {pie && <footer className="dialogo-pie">{pie}</footer>}
      </div>
    </div>
  );
}
