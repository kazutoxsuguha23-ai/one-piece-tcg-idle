import { formatNumber, formatDuration } from '../utils/format.js';
import styles from './TableHud.module.css';

// Interfaz (HTML) por encima de la mesa 3D: monedero, producción y botones.
export default function TableHud({
  nombre, monedas, produccion, pendiente, capSeg, ocupado, sinCartas, esAdmin, calidad, aviso,
  onRecogerTodo, onColeccion, onCatalogo, onCalidad, onAdmin, onSalir,
}) {
  return (
    <div className={styles.hud}>
      <div className={styles.arriba}>
        <div className={styles.jugador}>{nombre}</div>
        <div className={styles.monedero}>
          <span>Monedas</span>
          <strong>{formatNumber(monedas)}</strong>
        </div>
        <div className={styles.estadisticas}>
          <div><span>Producción</span><strong>{formatNumber(produccion)}/s</strong></div>
          <div><span>Pendiente</span><strong>{formatNumber(pendiente)}</strong></div>
          <div><span>Capacidad</span><strong>{formatDuration(capSeg)}</strong></div>
        </div>
      </div>

      {aviso && <div className={styles.aviso}>{aviso}</div>}
      {sinCartas && (
        <div className={styles.vacio}>Todavía no tienes cartas. Los sobres llegan en la Fase 7; mientras tanto el admin puede dártelas (F2).</div>
      )}

      <div className={styles.abajo}>
        <button type="button" className={styles.recoger} disabled={ocupado || sinCartas} onClick={onRecogerTodo}>
          Recoger todo (+{formatNumber(pendiente)})
        </button>
        <div className={styles.botones}>
          <button type="button" disabled title="Disponible en la Fase 7">Tienda · F7</button>
          <button type="button" disabled title="Disponible en la Fase 8">Álbum · F8</button>
          <button type="button" onClick={onColeccion}>Colección</button>
          <button type="button" disabled title="Disponible en la Fase 9">Mejoras · F9</button>
          <button type="button" onClick={onCatalogo}>Catálogo</button>
          <button type="button" onClick={onCalidad}>Calidad: {calidad}</button>
          {esAdmin && <button type="button" onClick={onAdmin}>Admin (F2)</button>}
          <button type="button" onClick={onSalir}>Salir</button>
        </div>
      </div>
    </div>
  );
}
