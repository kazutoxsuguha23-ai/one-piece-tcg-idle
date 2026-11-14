import { useCallback, useEffect, useState } from 'react';
import BotonConfirmar from './BotonConfirmar.jsx';
import { formatNumber } from '../utils/format.js';
import { buyUpgrade, listUpgrades, sellDuplicatesBulk } from '../services/upgradeService.js';
import styles from './MejorasPanel.module.css';

const RAREZAS = ['C', 'UC', 'R', 'L', 'SR', 'SEC', 'TR', 'PR', 'P'];

function textoEfecto(m, nivel) {
  if (m.type === 'prod_mult') return `×${(1 + nivel * m.per_level).toFixed(2)} de producción`;
  if (m.type === 'storage_seconds') return `+${formatNumber((nivel * m.per_level) / 3600)} h de almacén`;
  return '';
}

// Mejoras de toda la cuenta + venta de repetidas en masa.
export default function MejorasPanel({ coins, economia, onRefrescar }) {
  const [lista, setLista] = useState([]);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [rarezas, setRarezas] = useState(['C', 'UC']);
  const [variantes, setVariantes] = useState(false);
  const [preview, setPreview] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setLista(await listUpgrades());
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setPreview(null); }, [rarezas, variantes]);

  async function comprar(m) {
    setOcupado(true);
    setError('');
    setMensaje('');
    try {
      const r = await buyUpgrade(m.id, m.level);
      economia.aplicarSaldo(r.coins);
      await onRefrescar();
      setMensaje(`${m.name}: nivel ${r.level}`);
    } catch (e) {
      setError(e.message);
    }
    await cargar();
    setOcupado(false);
  }

  function alternar(r) {
    setRarezas((actual) => (actual.includes(r) ? actual.filter((x) => x !== r) : [...actual, r]));
  }

  async function calcular() {
    setOcupado(true);
    setError('');
    setMensaje('');
    try {
      setPreview(await sellDuplicatesBulk(rarezas, variantes, false, null));
    } catch (e) {
      setError(e.message);
    }
    setOcupado(false);
  }

  async function vender() {
    setOcupado(true);
    setError('');
    try {
      const r = await sellDuplicatesBulk(rarezas, variantes, true, preview.coins);
      economia.aplicarSaldo(r.coins_total);
      await economia.recargarCartas().catch(() => {});
      setMensaje(`Vendidas ${formatNumber(r.copies)} copias de ${formatNumber(r.cards)} cartas: +${formatNumber(r.coins)} monedas`);
      setPreview(null);
    } catch (e) {
      setError(e.message);
      setPreview(null);
    }
    setOcupado(false);
  }

  return (
    <div className={styles.panel}>
      <p className={styles.saldo}>Tus monedas: <strong>{formatNumber(coins)}</strong></p>
      {mensaje && <p className={styles.ok}>{mensaje}</p>}
      {error && <p className={styles.error}>{error}</p>}

      <section>
        <h3>Mejoras de la cuenta</h3>
        {lista.length === 0 && !error && <p className={styles.nota}>Cargando...</p>}
        <ul className={styles.lista}>
          {lista.map((m) => {
            const maximo = m.level >= m.max_level;
            const falta = !maximo && Number(coins) < Number(m.next_cost);
            return (
              <li key={m.id} className={styles.mejora}>
                <div className={styles.texto}>
                  <strong>{m.name} <small>nivel {m.level}/{m.max_level}</small></strong>
                  <span>{m.description}</span>
                  <small>
                    Ahora: {textoEfecto(m, m.level) || '—'}
                    {!maximo && ` → ${textoEfecto(m, m.level + 1)}`}
                  </small>
                </div>
                {maximo ? (
                  <span className={styles.maximo}>MÁX</span>
                ) : (
                  <button type="button" disabled={ocupado || falta} onClick={() => comprar(m)}>
                    Mejorar · {formatNumber(m.next_cost)}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h3>Vender repetidas en masa</h3>
        <p className={styles.nota}>
          Se vende todo lo que supere 1 copia de cada carta de las rarezas marcadas. La primera copia siempre se conserva.
          Las copias vendidas ya no sirven para subir de nivel.
        </p>
        <div className={styles.rarezas}>
          {RAREZAS.map((r) => (
            <label key={r} className={rarezas.includes(r) ? styles.activa : ''}>
              <input type="checkbox" checked={rarezas.includes(r)} onChange={() => alternar(r)} />
              {r}
            </label>
          ))}
        </div>
        <label className={styles.variantes}>
          <input type="checkbox" checked={variantes} onChange={(e) => setVariantes(e.target.checked)} />
          Incluir también arte alternativo, Manga y SP
        </label>
        <button type="button" disabled={ocupado || rarezas.length === 0} onClick={calcular}>Calcular</button>

        {preview && (
          preview.copies > 0 ? (
            <div className={styles.preview}>
              <p>
                <strong>{formatNumber(preview.copies)}</strong> copias de <strong>{formatNumber(preview.cards)}</strong> cartas
                {' '}→ <strong>+{formatNumber(preview.coins)}</strong> monedas
              </p>
              <BotonConfirmar
                etiqueta="Vender todo"
                resumen={`Venderás ${formatNumber(preview.copies)} copias. No se puede deshacer.`}
                disabled={ocupado}
                onConfirmar={vender}
                className={styles.vender}
              />
            </div>
          ) : (
            <p className={styles.nota}>No tienes repetidas con esos filtros.</p>
          )
        )}
      </section>
    </div>
  );
}
