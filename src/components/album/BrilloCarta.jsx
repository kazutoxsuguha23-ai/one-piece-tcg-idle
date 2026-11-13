import styles from './BrilloCarta.module.css';

const ALTAS = ['SEC', 'TR', 'SR', 'SP'];
const MEDIAS = ['L', 'R', 'PR', 'P'];

// Brillos sobre la carta: un destello de luz que sigue al puntero y un efecto "holográfico" de colores.
// Las cartas más raras (SR, SEC, TR, SP, Manga, arte alternativo) brillan más.
export default function BrilloCarta({ info, mx, my, fuerza = 1 }) {
  const alta = info.manga || info.sp || info.alt || ALTAS.includes(info.rarity);
  const base = alta ? 0.55 : MEDIAS.includes(info.rarity) ? 0.28 : 0.14;
  const estilo = {
    '--mx': `${mx}%`,
    '--my': `${my}%`,
    '--bx': `${mx}%`,
    '--by': `${my}%`,
    '--op': Math.min(0.9, base * fuerza),
  };
  return (
    <>
      <div className={styles.holo} style={estilo} />
      <div className={styles.destello} style={estilo} />
    </>
  );
}
