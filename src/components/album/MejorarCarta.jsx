import { useEffect, useState } from 'react';
import BotonConfirmar from '../BotonConfirmar.jsx';
import { formatNumber } from '../../utils/format.js';
import { cardUpgradeInfo, sellCardDuplicates, upgradeCard } from '../../services/upgradeService.js';
import styles from './MejorarCarta.module.css';

const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

// Sección de la ficha de una carta: subir de nivel (gasta copias repetidas de ESA carta + monedas) y
// vender repetidas. La primera copia nunca se gasta ni se vende. Todos los números salen del servidor.
export default function MejorarCarta({ info, poseida, economia, onSubida }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [cantidad, setCantidad] = useState(1);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vivo = true;
    cardUpgradeInfo(info.id)
      .then((d) => { if (vivo) { setDatos(d); setError(''); } })
      .catch((e) => { if (vivo) setError(e.message); });
    return () => { vivo = false; };
  }, [info.id, poseida.copies, poseida.level, version]);

  useEffect(() => {
    setCantidad(1);
    setMensaje('');
  }, [info.id]);

  const repetidas = datos ? Math.max(0, datos.spendable) : 0;
  useEffect(() => {
    setCantidad((c) => limitar(c, 1, Math.max(1, repetidas)));
  }, [repetidas]);

  async function ejecutar(accion) {
    setOcupado(true);
    setError('');
    setMensaje('');
    try {
      await accion();
    } catch (e) {
      setError(e.message);
      setVersion((v) => v + 1); // si algo cambió, se vuelve a pedir la información
    }
    setOcupado(false);
  }

  const mejorar = (niveles) => ejecutar(async () => {
    const r = await upgradeCard(info.id, datos.level, niveles);
    economia.aplicarSaldo(r.coins);
    await economia.recargarCartas().catch(() => {});
    onSubida({
      nivel: r.level,
      ganancia: formatNumber(Number(r.production_per_sec) - Number(r.old_production)),
    });
  });

  const vender = () => ejecutar(async () => {
    const r = await sellCardDuplicates(info.id, cantidad, datos.copies);
    economia.aplicarSaldo(r.coins);
    await economia.recargarCartas().catch(() => {});
    setMensaje(`Vendidas ${r.sold}: +${formatNumber(r.earned)} monedas`);
  });

  if (!datos) return <p className={styles.nota}>{error || 'Cargando mejoras...'}</p>;

  const maxNivel = datos.level >= datos.max_level;
  const plan = datos.plan ?? [];
  const opciones = [...new Set([1, 5, 10, datos.max_levels])].filter((n) => n >= 1 && n <= datos.max_levels);
  const valorVenta = Number(datos.sell_each) * cantidad;

  return (
    <div className={styles.caja}>
      <h3>Mejorar</h3>
      <div className={styles.nivel}>
        <span>Nivel <strong>{datos.level}</strong> / {datos.max_level}</span>
        <div className={styles.barra}><div style={{ width: `${(datos.level / datos.max_level) * 100}%` }} /></div>
      </div>

      {maxNivel ? (
        <p className={styles.nota}>¡Nivel máximo!</p>
      ) : (
        <>
          <p className={styles.linea}>
            Producción: <strong>{formatNumber(datos.production_now)}/s</strong> → <strong className={styles.sube}>{formatNumber(datos.production_next)}/s</strong>
          </p>
          <p className={styles.linea}>
            Siguiente nivel: <strong>{datos.next_cost.copies}</strong> {datos.next_cost.copies === 1 ? 'copia repetida' : 'copias repetidas'} + <strong>{formatNumber(datos.next_cost.coins)}</strong> monedas
          </p>
          <p className={styles.nota}>Tienes {repetidas} {repetidas === 1 ? 'repetida' : 'repetidas'} (la primera copia nunca se gasta).</p>
          {opciones.length === 0 ? (
            <p className={styles.nota}>Aún no te alcanza para subir de nivel.</p>
          ) : (
            <div className={styles.botones}>
              {opciones.map((n) => (
                <BotonConfirmar
                  key={n}
                  etiqueta={n === datos.max_levels && n > 1 ? `Máx (×${n})` : `Subir ×${n}`}
                  resumen={`Gastarás ${plan[n - 1].copies} ${plan[n - 1].copies === 1 ? 'copia' : 'copias'} y ${formatNumber(plan[n - 1].coins)} monedas`}
                  disabled={ocupado}
                  onConfirmar={() => mejorar(n)}
                  className={styles.principal}
                />
              ))}
            </div>
          )}
        </>
      )}

      <h3>Vender repetidas</h3>
      {repetidas < 1 ? (
        <p className={styles.nota}>No tienes copias repetidas de esta carta.</p>
      ) : (
        <>
          <div className={styles.cantidad}>
            <button type="button" disabled={ocupado || cantidad <= 1} onClick={() => setCantidad((c) => limitar(c - 1, 1, repetidas))}>−</button>
            <input
              type="number"
              min="1"
              max={repetidas}
              value={cantidad}
              onChange={(e) => setCantidad(limitar(parseInt(e.target.value, 10) || 1, 1, repetidas))}
              aria-label="Cantidad a vender"
            />
            <button type="button" disabled={ocupado || cantidad >= repetidas} onClick={() => setCantidad((c) => limitar(c + 1, 1, repetidas))}>+</button>
            <button type="button" disabled={ocupado || cantidad >= repetidas} onClick={() => setCantidad(repetidas)}>Todas</button>
          </div>
          <p className={styles.linea}>
            {formatNumber(datos.sell_each)} monedas por copia → <strong>+{formatNumber(valorVenta)}</strong>
          </p>
          <BotonConfirmar
            etiqueta={`Vender ${cantidad}`}
            resumen={`Te quedarán ${datos.copies - cantidad} ${datos.copies - cantidad === 1 ? 'copia' : 'copias'}. No se puede deshacer.`}
            disabled={ocupado}
            onConfirmar={vender}
            className={styles.vender}
          />
        </>
      )}

      {mensaje && <p className={styles.ok}>{mensaje}</p>}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
