import { useEffect, useRef, useState } from 'react';
import CardImage from '../CardImage.jsx';
import BrilloCarta from './BrilloCarta.jsx';
import CartaInspeccion from './CartaInspeccion.jsx';
import { formatNumber } from '../../utils/format.js';
import { colorRareza, etiquetaVariante } from '../../utils/rarityStyle.js';
import styles from './CartaDetalle.module.css';

function Fila({ etiqueta, valor }) {
  if (valor === null || valor === undefined || valor === '') return null;
  return (
    <div className={styles.fila}>
      <span>{etiqueta}</span>
      <strong>{valor}</strong>
    </div>
  );
}

const REPOSO = { x: 0, y: 0, mx: 50, my: 30 };

// Ficha de una carta: datos a un lado y la carta al otro. Al pasar el ratón se inclina y brilla;
// al pulsarla se agranda para inspeccionarla (girarla, verle los brillos...).
export default function CartaDetalle({ item, nombreSet, onClose, onPrev, onNext, onRecoger, ocupado }) {
  const { info, poseida } = item;
  const [inclinacion, setInclinacion] = useState(REPOSO);
  const [inspeccion, setInspeccion] = useState(null); // { rect } | null
  const cartaRef = useRef(null);
  const inspeccionRef = useRef(null);
  inspeccionRef.current = inspeccion;
  const color = colorRareza(info);

  useEffect(() => {
    setInclinacion(REPOSO);
    setInspeccion(null);
  }, [info.id]);

  useEffect(() => {
    function alPulsar(e) {
      if (inspeccionRef.current) return; // con la inspección abierta, las teclas son de la inspección
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onPrev();
      else if (e.key === 'ArrowRight') onNext();
    }
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [onClose, onPrev, onNext]);

  function alMover(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setInclinacion({ x: (0.5 - py) * 16, y: (px - 0.5) * 20, mx: px * 100, my: py * 100 });
  }

  function inspeccionar() {
    if (!poseida || !cartaRef.current) return;
    setInspeccion({ rect: cartaRef.current.getBoundingClientRect() });
  }

  return (
    <div className={styles.fondo} role="dialog" aria-label={`Carta ${info.id}`} onClick={onClose}>
      <div className={styles.ventana} onClick={(e) => e.stopPropagation()}>
        <div className={styles.escena} onPointerMove={alMover} onPointerLeave={() => setInclinacion(REPOSO)}>
          <div
            ref={cartaRef}
            className={`${styles.carta3d} ${color ? styles.conResplandor : ''} ${poseida ? styles.pulsable : ''} ${inspeccion ? styles.oculta : ''}`}
            role={poseida ? 'button' : undefined}
            tabIndex={poseida ? 0 : undefined}
            aria-label={poseida ? 'Inspeccionar la carta en grande' : undefined}
            onClick={inspeccionar}
            onKeyDown={(e) => { if (e.key === 'Enter') inspeccionar(); }}
            style={{
              transform: `rotateX(${inclinacion.x}deg) rotateY(${inclinacion.y}deg)`,
              '--glow': color ?? 'transparent',
            }}
          >
            <div className={styles.frente}>
              {poseida ? <CardImage info={info} /> : <div className={styles.silueta}>?</div>}
              {poseida && <BrilloCarta info={info} mx={inclinacion.mx} my={inclinacion.my} />}
            </div>
          </div>
          {poseida && <p className={styles.ayuda}>Pulsa la carta para inspeccionarla en grande</p>}
        </div>

        <div className={styles.datos}>
          <h2>{poseida ? info.name : 'Carta sin descubrir'}</h2>
          <div className={styles.lista}>
            <Fila etiqueta="Código" valor={info.id} />
            <Fila etiqueta="Set" valor={nombreSet} />
            <Fila etiqueta="Rareza" valor={etiquetaVariante(info)} />
            {poseida ? (
              <>
                <Fila etiqueta="Tipo" valor={info.type} />
                <Fila etiqueta="Color" valor={info.color} />
                <Fila etiqueta="Coste" valor={info.cost} />
                <Fila etiqueta="Poder" valor={info.power} />
                <Fila etiqueta="Counter" valor={info.counter} />
                <Fila etiqueta="Vida" valor={info.life} />
                <Fila etiqueta="Atributo" valor={info.attribute} />
                <Fila etiqueta="Tipos" valor={info.subtypes} />
                <hr />
                <Fila etiqueta="Copias" valor={poseida.copies} />
                <Fila etiqueta="Nivel" valor={poseida.level} />
                <Fila etiqueta="Producción" valor={`${formatNumber(poseida.production_per_sec)}/s`} />
                <Fila etiqueta="Acumulado" valor={formatNumber(poseida.pendiente)} />
              </>
            ) : (
              <p className={styles.nota}>Aún no tienes esta carta. Consíguela en los sobres de este set.</p>
            )}
          </div>
          {poseida && info.text && <p className={styles.texto}>{info.text}</p>}

          <div className={styles.botones}>
            {poseida && (
              <button type="button" onClick={inspeccionar}>Inspeccionar</button>
            )}
            {poseida && (
              <button
                type="button"
                className={styles.principal}
                disabled={ocupado || poseida.pendiente < 1}
                onClick={() => onRecoger(info.id)}
              >
                Recoger (+{formatNumber(poseida.pendiente)})
              </button>
            )}
            <button type="button" onClick={onPrev}>◀ Anterior</button>
            <button type="button" onClick={onNext}>Siguiente ▶</button>
            <button type="button" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>

      {inspeccion && (
        <CartaInspeccion info={info} origen={inspeccion.rect} onClose={() => setInspeccion(null)} />
      )}
    </div>
  );
}
