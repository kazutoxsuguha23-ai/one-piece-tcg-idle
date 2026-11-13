import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CardImage from '../CardImage.jsx';
import BrilloCarta from './BrilloCarta.jsx';
import { colorRareza, etiquetaVariante } from '../../utils/rarityStyle.js';
import styles from './CartaInspeccion.module.css';

const DURACION = 450;
const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

// Tamaño y posición finales de la carta (centrada, lo más grande que quepa).
function medidas() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const ancho = Math.min(vw * 0.9, vh * 0.8 * (5 / 7), 560);
  return { ancho, alto: (ancho * 7) / 5, izq: (vw - ancho) / 2, arriba: (vh - (ancho * 7) / 5) / 2 - 12 };
}

// Inspección de una carta: se agranda con animación desde su sitio, se gira arrastrando (con inercia),
// se acerca con la rueda o los botones y brilla según la rareza. Esc o pulsar fuera = volver.
export default function CartaInspeccion({ info, origen, onClose }) {
  const [fase, setFase] = useState('inicio'); // inicio -> abierta -> cerrando
  const [m, setM] = useState(medidas);
  const [rot, setRot] = useState({ x: 0, y: 0 });
  const [escala, setEscala] = useState(1);
  const [suave, setSuave] = useState(false);
  const [luz, setLuz] = useState({ x: 50, y: 30 });
  const cartaRef = useRef(null);
  const arrastre = useRef(null);
  const vel = useRef({ x: 0, y: 0 });
  const cerrando = useRef(false);
  const esperas = useRef([]);
  const color = colorRareza(info);

  // Entrada: la carta empieza en su sitio de la ficha y, un instante después, se agranda.
  useEffect(() => {
    let b = 0;
    const a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => setFase('abierta'));
    });
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
      esperas.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  useEffect(() => {
    const alRedimensionar = () => setM(medidas());
    window.addEventListener('resize', alRedimensionar);
    return () => window.removeEventListener('resize', alRedimensionar);
  }, []);

  const cerrar = useCallback(() => {
    if (cerrando.current) return;
    cerrando.current = true;
    setFase('cerrando');
    esperas.current.push(setTimeout(onClose, DURACION));
  }, [onClose]);

  const acercar = useCallback((d) => setEscala((e) => limitar(e + d, 0.6, 2.4)), []);

  const reencuadrar = useCallback(() => {
    vel.current = { x: 0, y: 0 };
    setSuave(true);
    setRot((r) => ({ x: 0, y: Math.round(r.y / 360) * 360 }));
    setEscala(1);
  }, []);

  useEffect(() => {
    function alPulsar(e) {
      if (e.key === 'Escape') cerrar();
      else if (e.key === '+' || e.key === '=') acercar(0.2);
      else if (e.key === '-') acercar(-0.2);
    }
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [cerrar, acercar]);

  // Inercia: al soltar, la carta sigue girando y se va frenando.
  useEffect(() => {
    let id = 0;
    let ultimo = performance.now();
    const bucle = (t) => {
      const dt = Math.min(0.05, (t - ultimo) / 1000);
      ultimo = t;
      const v = vel.current;
      if (!arrastre.current && (Math.abs(v.x) > 4 || Math.abs(v.y) > 4)) {
        setRot((r) => ({ x: limitar(r.x + v.x * dt, -75, 75), y: r.y + v.y * dt }));
        v.x *= 0.93;
        v.y *= 0.93;
      }
      id = requestAnimationFrame(bucle);
    };
    id = requestAnimationFrame(bucle);
    return () => cancelAnimationFrame(id);
  }, []);

  function alPresionar(e) {
    if (window.getSelection) window.getSelection().removeAllRanges();
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastre.current = {
      ultimoX: e.clientX,
      ultimoY: e.clientY,
      t: e.timeStamp,
      mov: 0,
      dentro: cartaRef.current ? cartaRef.current.contains(e.target) : false,
    };
    vel.current = { x: 0, y: 0 };
    setSuave(false);
  }

  function alMover(e) {
    if (cartaRef.current) {
      const r = cartaRef.current.getBoundingClientRect();
      setLuz({
        x: limitar(((e.clientX - r.left) / r.width) * 100, -20, 120),
        y: limitar(((e.clientY - r.top) / r.height) * 100, -20, 120),
      });
    }
    const a = arrastre.current;
    if (!a) return;
    const dx = e.clientX - a.ultimoX;
    const dy = e.clientY - a.ultimoY;
    const dt = Math.max(0.008, (e.timeStamp - a.t) / 1000);
    a.mov += Math.abs(dx) + Math.abs(dy);
    a.ultimoX = e.clientX;
    a.ultimoY = e.clientY;
    a.t = e.timeStamp;
    const gy = dx * 0.5;
    const gx = -dy * 0.4;
    setRot((r) => ({ x: limitar(r.x + gx, -75, 75), y: r.y + gy }));
    vel.current = { x: limitar(gx / dt, -600, 600), y: limitar(gy / dt, -900, 900) };
  }

  function alSoltar(e) {
    const a = arrastre.current;
    arrastre.current = null;
    if (!a) return;
    if (a.mov < 6 && !a.dentro) cerrar(); // pulsar fuera de la carta = volver
    if (e.timeStamp - a.t > 90) vel.current = { x: 0, y: 0 };
  }

  const s = origen.width / m.ancho;
  const dx0 = origen.left - m.izq;
  const dy0 = origen.top - m.arriba;
  const inclinacion = Math.hypot(rot.x, Math.sin((rot.y * Math.PI) / 180) * 60);
  const fuerza = 0.5 + Math.min(1, inclinacion / 60) * 0.9;
  const mx = limitar(luz.x + Math.sin((rot.y * Math.PI) / 180) * 25, -20, 120);

  return createPortal(
    <div
      className={`${styles.fondo} ${fase === 'abierta' ? styles.visible : ''}`}
      role="dialog"
      aria-label="Inspeccionar carta"
      onPointerDown={alPresionar}
      onPointerMove={alMover}
      onPointerUp={alSoltar}
      onPointerCancel={alSoltar}
      onWheel={(e) => acercar(-e.deltaY * 0.0015)}
      // Los eventos de un portal suben por el árbol de React hasta la ficha: sin esto, un clic aquí
      // cerraría también la ficha de la carta.
      onClick={(e) => e.stopPropagation()}
    >
      <div
        ref={cartaRef}
        className={styles.carta}
        style={{
          left: m.izq,
          top: m.arriba,
          width: m.ancho,
          height: m.alto,
          transform: fase === 'abierta' ? 'none' : `translate(${dx0}px, ${dy0}px) scale(${s})`,
          transition: fase === 'inicio' ? 'none' : `transform ${DURACION}ms cubic-bezier(0.2, 0.8, 0.2, 1)`,
        }}
      >
        <div
          className={`${styles.giro} ${color ? styles.conResplandor : ''}`}
          style={{
            transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg) scale(${escala})`,
            transition: suave ? 'transform 0.6s ease' : 'none',
            '--glow': color ?? 'transparent',
          }}
        >
          <div className={styles.frente}>
            <CardImage info={info} />
            <BrilloCarta info={info} mx={mx} my={luz.y} fuerza={fuerza} />
          </div>
          <div className={styles.dorso}>
            <span>ONE PIECE</span>
            <span>TCG IDLE</span>
          </div>
        </div>
      </div>

      <div className={styles.barra} onPointerDown={(e) => e.stopPropagation()}>
        <span className={styles.titulo}>{info.name} · {etiquetaVariante(info)}</span>
        <div className={styles.botones}>
          <button type="button" onClick={() => acercar(-0.2)}>Zoom −</button>
          <button type="button" onClick={() => acercar(0.2)}>Zoom +</button>
          <button type="button" onClick={reencuadrar}>Reencuadrar</button>
          <button type="button" className={styles.principal} onClick={cerrar}>Volver</button>
        </div>
        <span className={styles.ayuda}>Arrastra para girarla · Rueda = zoom · Pulsa fuera o Esc para volver</span>
      </div>
    </div>,
    document.body,
  );
}
