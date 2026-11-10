import { useEffect } from 'react';
import styles from './ModalPanel.module.css';

export default function ModalPanel({ titulo, onClose, children }) {
  useEffect(() => {
    function alPulsar(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [onClose]);

  return (
    <div className={styles.fondo} role="dialog" aria-label={titulo}>
      <div className={styles.ventana}>
        <header className={styles.cabecera}>
          <h2>{titulo}</h2>
          <button type="button" onClick={onClose}>Cerrar (Esc)</button>
        </header>
        <div className={styles.contenido}>{children}</div>
      </div>
    </div>
  );
}
