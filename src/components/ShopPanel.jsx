import { useEffect, useRef, useState } from 'react';
import { formatNumber } from '../utils/format.js';
import { getPackArtTexture } from '../utils/packTexture.js';
import styles from './ShopPanel.module.css';

const TIPOS = [
  ['booster', 'Boosters'],
  ['extra_booster', 'Extra Boosters'],
  ['premium_booster', 'Premium Boosters'],
  ['starter_deck', 'Starter Decks'],
];
const CANTIDADES = [1, 5, 10];

function Miniatura({ producto }) {
  const ref = useRef(null);
  useEffect(() => {
    const textura = getPackArtTexture(producto);
    const ctx = ref.current?.getContext('2d');
    if (ctx && textura.image) ctx.drawImage(textura.image, 0, 0, 54, 96);
  }, [producto]);
  return <canvas ref={ref} width={54} height={96} className={styles.mini} />;
}

export default function ShopPanel({ productos, coins, ocupado, error, onComprar }) {
  const [mensaje, setMensaje] = useState('');

  async function comprar(producto, cantidad) {
    setMensaje('');
    try {
      await onComprar(producto.product_id, cantidad);
      setMensaje(`Comprado: ${cantidad} × ${producto.name}. Lo verás en la mesa.`);
    } catch {
      /* el error se muestra debajo */
    }
  }

  if (productos.length === 0) {
    return (
      <p className={styles.vacio}>
        No hay productos en la tienda todavía. En el menú de admin (F2) usa «Sincronizar productos con el catálogo».
      </p>
    );
  }

  return (
    <div className={styles.tienda}>
      <p className={styles.saldo}>Tus monedas: <strong>{formatNumber(coins)}</strong></p>
      {mensaje && <p className={styles.ok}>{mensaje}</p>}
      {error && <p className={styles.error}>{error}</p>}
      <p className={styles.nota}>
        Las probabilidades de los sobres son ficticias de este juego: no son las oficiales del TCG.
      </p>
      {TIPOS.map(([tipo, titulo]) => {
        const lista = productos.filter((p) => p.kind === tipo);
        if (lista.length === 0) return null;
        return (
          <section key={tipo}>
            <h3>{titulo}</h3>
            <ul className={styles.lista}>
              {lista.map((p) => (
                <li key={p.product_id} className={styles.fila}>
                  <Miniatura producto={p} />
                  <div className={styles.nombre}>
                    <strong>{p.name}</strong>
                    <small>{p.set_id} · {formatNumber(p.price)} monedas</small>
                  </div>
                  <div className={styles.botones}>
                    {CANTIDADES.map((n) => (
                      <button
                        key={n}
                        type="button"
                        disabled={ocupado || Number(coins) < p.price * n}
                        onClick={() => comprar(p, n)}
                        title={`${formatNumber(p.price * n)} monedas`}
                      >
                        ×{n}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
