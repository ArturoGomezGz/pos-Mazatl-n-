interface Props {
  onTecla: (tecla: string) => void;
  onBorrar: () => void;
  /** Botón extra a la derecha del cero (por ejemplo "00" o el punto decimal). */
  teclaExtra?: string;
}

/** Teclado grande. En caja y en piso se teclea con el dedo y con prisa. */
export function TecladoNumerico({ onTecla, onBorrar, teclaExtra = '00' }: Props) {
  return (
    <div className="teclado">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((t) => (
        <button key={t} type="button" className="tecla" onClick={() => onTecla(t)}>
          {t}
        </button>
      ))}
      <button type="button" className="tecla" onClick={() => onTecla(teclaExtra)}>
        {teclaExtra}
      </button>
      <button type="button" className="tecla" onClick={() => onTecla('0')}>
        0
      </button>
      <button type="button" className="tecla borrar" onClick={onBorrar} aria-label="Borrar">
        ←
      </button>
    </div>
  );
}
