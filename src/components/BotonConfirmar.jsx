import { useEffect, useRef, useState } from 'react';
import styles from './BotonConfirmar.module.css';

// Botón de dos pasos para operaciones que no se pueden deshacer: el primer clic lo "arma" y enseña
// qué va a pasar; el segundo lo ejecuta. Se desarma solo a los 6 segundos.
export default function BotonConfirmar({ etiqueta, resumen, onConfirmar, disabled, className }) {
  const [armado, setArmado] = useState(false);
  const temporizador = useRef(null);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  function desarmar() {
    clearTimeout(temporizador.current);
    setArmado(false);
  }

  function pulsar() {
    if (!armado) {
      setArmado(true);
      temporizador.current = setTimeout(() => setArmado(false), 6000);
      return;
    }
    desarmar();
    onConfirmar();
  }

  return (
    <span className={styles.caja}>
      <button
        type="button"
        className={`${className ?? ''} ${armado ? styles.armado : ''}`}
        disabled={disabled}
        onClick={pulsar}
      >
        {armado ? 'Confirmar' : etiqueta}
      </button>
      {armado && (
        <>
          <span className={styles.resumen}>{resumen}</span>
          <button type="button" onClick={desarmar}>Cancelar</button>
        </>
      )}
    </span>
  );
}
