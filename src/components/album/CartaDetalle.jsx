import { useEffect, useRef, useState } from 'react';
import CardImage from '../CardImage.jsx';
import { formatNumber } from '../../utils/format.js';
import { colorRareza, etiquetaVariante } from '../../utils/rarityStyle.js';
import styles from './CartaDetalle.module.css';

const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

function Fila({ etiqueta, valor }) {
  if (valor === null || valor === undefined || valor === '') return null;
  return (
    <div className={styles.fila}>
      <span>{etiqueta}</span>
      <strong>{valor}</strong>
    </div>
  );
}

// Ficha de una carta: se puede girar en 3D arrastrando (con su imagen real) y recoger lo que ha generado.
export default function CartaDetalle({ item, nombreSet, onClose, onPrev, onNext, onRecoger, ocupado }) {
  const { info, poseida } = item;
  const [rot, setRot] = useState({ x: 0, y: 0 });
  const [suave, setSuave] = useState(false);
  const arrastre = useRef(null);
  const color = colorRareza(info);

  useEffect(() => {
    setRot({ x: 0, y: 0 });
  }, [info.id]);

  useEffect(() => {
    function alPulsar(e) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onPrev();
      else if (e.key === 'ArrowRight') onNext();
    }
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [onClose, onPrev, onNext]);

  function alPresionar(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastre.current = { x: e.clientX, y: e.clientY, rx: rot.x, ry: rot.y };
    setSuave(false);
  }
  function alMover(e) {
    const a = arrastre.current;
    if (!a) return;
    setRot({
      x: limitar(a.rx - (e.clientY - a.y) * 0.4, -70, 70),
      y: a.ry + (e.clientX - a.x) * 0.5,
    });
  }
  function alSoltar() {
    arrastre.current = null;
  }
  function reencuadrar() {
    setSuave(true);
    // Vuelve a la cara frontal por el camino más corto
    setRot((r) => ({ x: 0, y: Math.round(r.y / 360) * 360 }));
  }

  const brillo = 50 + Math.sin((rot.y * Math.PI) / 180) * 60;

  return (
    <div className={styles.fondo} role="dialog" aria-label={`Carta ${info.id}`} onClick={onClose}>
      <div className={styles.ventana} onClick={(e) => e.stopPropagation()}>
        <div
          className={styles.escena}
          onPointerDown={alPresionar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
        >
          <div
            className={`${styles.carta3d} ${color ? styles.conResplandor : ''}`}
            style={{
              transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
              transition: suave ? 'transform 0.5s ease' : 'none',
              '--glow': color ?? 'transparent',
            }}
          >
            <div className={styles.frente}>
              {poseida ? <CardImage info={info} /> : <div className={styles.silueta}>?</div>}
              <div className={styles.brillo} style={{ backgroundPosition: `${brillo}% 0` }} />
            </div>
            <div className={styles.dorso}>
              <span>ONE PIECE</span>
              <span>TCG IDLE</span>
            </div>
          </div>
          <p className={styles.ayuda}>Arrastra para girar la carta</p>
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
              <button
                type="button"
                className={styles.principal}
                disabled={ocupado || poseida.pendiente < 1}
                onClick={() => onRecoger(info.id)}
              >
                Recoger (+{formatNumber(poseida.pendiente)})
              </button>
            )}
            <button type="button" onClick={reencuadrar}>Reencuadrar</button>
            <button type="button" onClick={onPrev}>◀ Anterior</button>
            <button type="button" onClick={onNext}>Siguiente ▶</button>
            <button type="button" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
