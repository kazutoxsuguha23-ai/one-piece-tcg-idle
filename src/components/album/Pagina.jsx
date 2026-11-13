import CardImage from '../CardImage.jsx';
import { formatNumber } from '../../utils/format.js';
import { colorRareza } from '../../utils/rarityStyle.js';
import styles from './Pagina.module.css';

function Casilla({ item, onAbrir, onRecoger, ocupado }) {
  const { info, poseida } = item;
  if (!poseida) {
    return (
      <div className={styles.casilla}>
        <button
          type="button"
          className={styles.desconocida}
          onClick={() => onAbrir(item)}
          title={`${info.id} (sin descubrir)`}
        >
          <span>?</span>
        </button>
        <div className={styles.pie}>
          <span className={styles.nombre}>{info.id}</span>
          <small>Sin descubrir</small>
        </div>
      </div>
    );
  }
  return (
    <div className={styles.casilla}>
      <button
        type="button"
        className={styles.carta}
        style={{ '--color': colorRareza(info) ?? '#b9ab8c' }}
        onClick={() => onAbrir(item)}
        title={info.name}
      >
        <CardImage info={info} />
      </button>
      {poseida.pendiente >= 1 && (
        <button
          type="button"
          className={styles.moneda}
          disabled={ocupado}
          onClick={() => onRecoger(info.id)}
          title="Recoger las monedas de esta carta"
        >
          +{formatNumber(poseida.pendiente)}
        </button>
      )}
      <div className={styles.pie}>
        <span className={styles.nombre}>{info.name}</span>
        <small>x{poseida.copies} · Nv.{poseida.level} · {formatNumber(poseida.production_per_sec)}/s</small>
      </div>
    </div>
  );
}

// Una página del álbum: rejilla de 3x3 con las cartas (o huecos). `items === null` = hoja en blanco.
export default function Pagina({ items, numero, onAbrir, onRecoger, ocupado }) {
  if (!items) return <div className={styles.guarda} />;
  return (
    <div className={styles.pagina}>
      <div className={styles.rejilla}>
        {Array.from({ length: 9 }, (_, i) => (
          items[i]
            ? <Casilla key={items[i].info.id} item={items[i]} onAbrir={onAbrir} onRecoger={onRecoger} ocupado={ocupado} />
            : <div key={`v${i}`} className={styles.vacia} />
        ))}
      </div>
      <div className={styles.numero}>{numero}</div>
    </div>
  );
}
