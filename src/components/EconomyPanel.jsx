import { useEffect, useState } from 'react';
import { loadCatalog } from '../services/catalogService.js';
import { formatNumber, formatDuration } from '../utils/format.js';
import styles from './EconomyPanel.module.css';

const MAX_FILAS = 100;

// Panel temporal de la Fase 5: la mesa 3D (Fase 6) lo sustituirá.
export default function EconomyPanel({ economia }) {
  const {
    coins, produccion, totalPendiente, filas, capSeg, ocupado, aviso, ultimaRecogida,
    recogerTodo, recogerCarta,
  } = economia;
  const [catalogo, setCatalogo] = useState(null);

  useEffect(() => {
    loadCatalog().then(setCatalogo).catch(() => setCatalogo(null));
  }, []);

  const visibles = filas.slice(0, MAX_FILAS);

  return (
    <section className={styles.panel}>
      <div className={styles.resumen}>
        <div className={styles.dato}>
          <span>Monedas</span>
          <strong>{formatNumber(coins)}</strong>
          {ultimaRecogida && ultimaRecogida.cantidad > 0 && (
            <em key={ultimaRecogida.id} className={styles.flota}>+{formatNumber(ultimaRecogida.cantidad)}</em>
          )}
        </div>
        <div className={styles.dato}>
          <span>Producción</span>
          <strong>{formatNumber(produccion)}/s</strong>
        </div>
        <div className={styles.dato}>
          <span>Pendiente</span>
          <strong>{formatNumber(totalPendiente)}</strong>
        </div>
        <div className={styles.dato}>
          <span>Capacidad</span>
          <strong>{formatDuration(capSeg)}</strong>
        </div>
      </div>

      <button type="button" className={styles.recogerTodo} disabled={ocupado || filas.length === 0} onClick={recogerTodo}>
        Recoger todo (+{formatNumber(totalPendiente)})
      </button>
      {aviso && <p className={styles.error}>{aviso.texto}</p>}

      {filas.length === 0 ? (
        <p className={styles.vacio}>
          Todavía no tienes cartas. Los sobres llegan en la Fase 7; mientras tanto el admin puede darte cartas (F2).
        </p>
      ) : (
        <ul className={styles.lista}>
          {visibles.map((fila) => {
            const info = catalogo?.byId.get(fila.card_id);
            return (
              <li key={fila.card_id} className={styles.fila}>
                {info?.image && <img src={info.image} alt="" loading="lazy" />}
                <div className={styles.nombre}>
                  <strong>{info?.name ?? fila.card_id}</strong>
                  <small>
                    {info ? `${info.code} · ${info.rarity}${info.manga ? ' · Manga' : info.sp ? ' · SP' : info.alt ? ' · Alt' : ''}` : ''}
                    {' '}· Nv. {fila.level} · x{fila.copies}
                  </small>
                </div>
                <div className={styles.cifras}>
                  <span>{formatNumber(fila.production_per_sec)}/s</span>
                  <small>+{formatNumber(fila.pendiente)}</small>
                </div>
                <button type="button" disabled={ocupado || fila.pendiente < 1} onClick={() => recogerCarta(fila.card_id)}>
                  Recoger
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {filas.length > MAX_FILAS && (
        <small className={styles.nota}>Mostrando las {MAX_FILAS} cartas con más producción de {filas.length}. El álbum (Fase 8) las mostrará todas.</small>
      )}
    </section>
  );
}
