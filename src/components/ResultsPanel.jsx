import ModalPanel from './ModalPanel.jsx';
import CardImage from './CardImage.jsx';
import styles from './ResultsPanel.module.css';

// Resumen al terminar de revelar: cartas nuevas y repetidas. Al pasar el ratón (o al tocar / tabular)
// cada carta se levanta y se ve en grande.
export default function ResultsPanel({ cartas, sobres, restantes, onCerrar, onOtro }) {
  const nuevas = cartas.filter((c) => c.esNueva).length;
  return (
    <ModalPanel titulo={sobres > 1 ? `Resultado de ${sobres} sobres` : 'Resultado del sobre'} onClose={onCerrar}>
      <div className={styles.cuerpo}>
        <p className={styles.resumen}>
          {cartas.length} cartas · <strong>{nuevas}</strong> nuevas · <strong>{cartas.length - nuevas}</strong> repetidas
        </p>
        <div className={styles.rejilla}>
          {cartas.map((c, i) => (
            <figure key={`${c.info.id}-${i}`} className={styles.carta} tabIndex={0}>
              <div className={styles.marco}>
                <CardImage info={c.info} />
              </div>
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
