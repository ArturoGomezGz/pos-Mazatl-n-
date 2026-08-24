import { useState } from 'react';
import { Dialogo } from './Dialogo';
import { TecladoNumerico } from './TecladoNumerico';

interface Props {
  titulo: string;
  /** Explica qué se va a autorizar: el cajero debe saber qué está firmando. */
  detalle: string;
  pedirMotivo?: boolean;
  onCancelar: () => void;
  onConfirmar: (datos: { pin: string; motivo: string }) => void;
}

/** Un solo mecanismo para todas las acciones sensibles: cancelar, descontar,
 *  reabrir. Pide motivo y el PIN de alguien con permiso. */
export function PedirAutorizacion({ titulo, detalle, pedirMotivo = true, onCancelar, onConfirmar }: Props) {
  const [pin, setPin] = useState('');
  const [motivo, setMotivo] = useState('');

  const listo = pin.length >= 4 && (!pedirMotivo || motivo.trim().length >= 3);

  const acciones = (
    <div className="acciones-dialogo">
      <button className="btn" onClick={onCancelar}>Cancelar</button>
      <button className="btn primario" disabled={!listo} onClick={() => onConfirmar({ pin, motivo: motivo.trim() })}>
        Autorizar
      </button>
    </div>
  );

  return (
    <Dialogo titulo={titulo} onCerrar={onCancelar} ancho={420} pie={acciones}>
      <p className="detalle-dialogo">{detalle}</p>

      {pedirMotivo && (
        <div className="campo">
          <label htmlFor="motivo-autorizacion">Motivo</label>
          <input
            id="motivo-autorizacion"
            value={motivo}
            maxLength={120}
            placeholder="Ej. el cliente cambió de opinión"
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>
      )}

      <div className="campo">
        <label>PIN de cajero o administrador</label>
        <div className="pin-puntos">{'•'.repeat(pin.length) || '····'}</div>
      </div>

      <TecladoNumerico
        teclaExtra=""
        onTecla={(t) => t && setPin((p) => (p.length < 6 ? p + t : p))}
        onBorrar={() => setPin((p) => p.slice(0, -1))}
      />
    </Dialogo>
  );
}
