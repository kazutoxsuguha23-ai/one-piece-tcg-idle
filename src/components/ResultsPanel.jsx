import ModalPanel from './ModalPanel.jsx';
import styles from './ResultsPanel.module.css';

// Resumen al terminar de revelar un sobre: cartas nuevas y repetidas.
export default function ResultsPanel({ cartas, restantes, onCerrar, onOtro }) {
  const nuevas = cartas.filter((c) => c.esNueva).length;
  return (
    <ModalPanel titulo="Resultado del sobre" onClose={onCerrar}>
      <div className={styles.cuerpo}>
        <p className={styles.resumen}>
          <strong>{nuevas}</strong> nuevas · <strong>{cartas.length - nuevas}</strong> repetidas
        </p>
        <div className={styles.rejilla}>
          {cartas.map((c, i) => (
            <figure key={`${c.info.id}-${i}`} className={styles.carta}>
              {c.info.image && (
                <img
                  src={c.info.image}
                  alt={c.info.name}
                  loading="lazy"
                  onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                />
              )}
              <figcaption>
                <span>{c.info.name}</span>
                <small>{c.info.rarity}</small>
                <em className={c.esNueva ? styles.nueva : styles.repetida}>{c.esNueva ? 'NUEVA' : 'REPETIDA'}</em>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className={styles.nota}>Tus cartas producen monedas: reclámalas desde «Colección» (y desde el Álbum cuando exista).</p>
        <div className={styles.botones}>
          {restantes > 0 && <button type="button" onClick={onOtro}>Abrir otro sobre ({restantes})</button>}
          <button type="button" onClick={onCerrar}>Volver a la mesa</button>
        </div>
      </div>
    </ModalPanel>
  );
}
