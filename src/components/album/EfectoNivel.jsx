import { useEffect, useRef } from 'react';
import styles from './EfectoNivel.module.css';

// Efecto de subida de nivel: destello, chispas que salen en todas direcciones y el texto "¡NIVEL N!".
export default function EfectoNivel({ nivel, ganancia, onFin }) {
  const fin = useRef(onFin);
  fin.current = onFin;

  useEffect(() => {
    const id = setTimeout(() => fin.current(), 2100);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className={styles.efecto} aria-live="polite">
      <div className={styles.destello} />
      {Array.from({ length: 20 }, (_, i) => (
        <span
          key={i}
          className={styles.chispa}
          style={{
            '--ang': `${(i / 20) * 360}deg`,
            '--dist': `${80 + (i % 3) * 30}px`,
            '--ret': `${(i % 5) * 40}ms`,
          }}
        />
      ))}
      <div className={styles.texto}>
        <strong>¡NIVEL {nivel}!</strong>
        {ganancia ? <span>+{ganancia}/s</span> : null}
      </div>
    </div>
  );
}
