import { useEffect, useState, type ReactNode } from 'react';

interface Props {
  titulo: string;
  children: ReactNode;
  onCerrar: () => void;
  ancho?: number;
  /** Acciones que se quedan fijas al pie, fuera del área con scroll. */
  pie?: ReactNode;
}

/** Diálogo simple. Se cierra con Escape, con el botón ✕, o tocando fuera.
 *  Tocar fuera pide confirmación: en una tablet es fácil rozar el velo sin
 *  querer y perder lo capturado en el formulario. El cuerpo hace scroll si
 *  no cabe; el pie (si lo hay) se queda siempre visible. */
export function Dialogo({ titulo, children, onCerrar, ancho = 520, pie }: Props) {
  const [pidiendoConfirmacion, setPidiendoConfirmacion] = useState(false);

  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [onCerrar]);

  return (
    <div className="velo" onClick={() => setPidiendoConfirmacion(true)}>
      <div className="dialogo" style={{ maxWidth: ancho }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={titulo}>
        <header className="dialogo-encabezado">
          <h2>{titulo}</h2>
          <button className="btn fantasma" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </header>
        <div className="dialogo-cuerpo">{children}</div>
        {pie && <footer className="dialogo-pie">{pie}</footer>}
      </div>

      {pidiendoConfirmacion && (
        <div className="velo" onClick={(e) => e.stopPropagation()}>
          <div className="dialogo dialogo-confirmacion" style={{ maxWidth: 340 }} role="alertdialog" aria-label="Confirmar cierre">
            <div className="dialogo-cuerpo">
              <p>¿Seguro que quieres cerrar?</p>
              <div className="acciones-dialogo">
                <button className="btn" onClick={() => setPidiendoConfirmacion(false)}>No, seguir</button>
                <button className="btn primario" onClick={onCerrar}>Sí, cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
