import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import { AdditiveBlending } from 'three';
import { getCardBackTexture, getCardFaceTexture, getGlowTexture } from '../../utils/cardTexture.js';
import { loadRemoteTexture } from '../../utils/imageLoader.js';
import { tipoEfecto } from './Card3D.jsx';

const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
const BORDE = '#e8e4d8';

// Cuerpo de una carta: caja fina con cara y dorso.
function CartaMesh({ cara, dorso }) {
  return (
    <mesh castShadow>
      <boxGeometry args={[1.4, 1.96, 0.03]} />
      <meshStandardMaterial attach="material-0" color={BORDE} />
      <meshStandardMaterial attach="material-1" color={BORDE} />
      <meshStandardMaterial attach="material-2" color={BORDE} />
      <meshStandardMaterial attach="material-3" color={BORDE} />
      <meshStandardMaterial attach="material-4" map={cara} roughness={0.45} metalness={0.05} />
      <meshStandardMaterial attach="material-5" map={dorso} roughness={0.6} />
    </mesh>
  );
}

// Carta que entra volteándose desde abajo. Toca para pasar a la siguiente; arrastra para girarla.
function CartaActual({ carta, conEfectos, onAvanzar }) {
  const { info } = carta;
  const grupo = useRef();
  const halo = useRef();
  const tiempo = useRef(0);
  const giro = useRef({ x: 0, y: 0, visX: 0, visY: 0 });
  const [cara, setCara] = useState(() => getCardFaceTexture(info));
  const dorso = useMemo(() => getCardBackTexture(), []);
  const brillo = useMemo(() => getGlowTexture(), []);
  const efecto = tipoEfecto(info);

  useEffect(() => {
    let vivo = true;
    loadRemoteTexture(info.image).then((t) => {
      if (vivo && t) setCara(t);
    });
    return () => { vivo = false; };
  }, [info]);

  useFrame((reloj, delta) => {
    const g = grupo.current;
    if (!g) return;
    tiempo.current += delta;
    const k = Math.min(1, tiempo.current / 0.75);
    const e = 1 - (1 - k) ** 3;
    const r = giro.current;
    const suave = Math.min(1, delta * 12);
    r.visX += (r.x - r.visX) * suave;
    r.visY += (r.y - r.visY) * suave;
    g.position.set(0, -2.2 * (1 - e) + Math.sin(reloj.clock.elapsedTime * 1.3) * 0.03, 0.8 * (1 - e));
    g.rotation.set(r.visX, r.visY + (1 - e) * Math.PI, (1 - e) * 0.4);
    g.scale.setScalar(1.55 * (0.6 + 0.4 * e));
    if (halo.current) halo.current.material.opacity = 0.6 + Math.sin(reloj.clock.elapsedTime * 2.2) * 0.2;
  });

  function alPresionar(ev) {
    ev.stopPropagation();
    const inicio = { x: ev.nativeEvent.clientX, y: ev.nativeEvent.clientY };
    let ultimo = inicio;
    let movido = false;

    const mover = (m) => {
      if (Math.hypot(m.clientX - inicio.x, m.clientY - inicio.y) > 8) movido = true;
      if (movido) {
        giro.current.y += (m.clientX - ultimo.x) * 0.012;
        giro.current.x = limitar(giro.current.x + (m.clientY - ultimo.y) * 0.008, -0.9, 0.9);
      }
      ultimo = { x: m.clientX, y: m.clientY };
    };
    const soltar = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      window.removeEventListener('pointercancel', soltar);
      if (!movido && tiempo.current > 0.6) onAvanzar();
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', soltar);
  }

  return (
    <group
      ref={grupo}
      onPointerDown={alPresionar}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}
    >
      <CartaMesh cara={cara} dorso={dorso} />
      {efecto && (
        <mesh ref={halo} position={[0, 0, -0.03]}>
          <planeGeometry args={[1.85, 2.45]} />
          <meshBasicMaterial map={brillo} color={efecto.color} transparent opacity={0.6} blending={AdditiveBlending} depthWrite={false} />
        </mesh>
      )}
      {efecto && conEfectos && (
        <Sparkles count={efecto.chispas * 2} scale={[2.2, 3, 1.5]} position={[0, 0, 0.6]} size={5} speed={0.6} color={efecto.color} />
      )}
    </group>
  );
}

// La carta anterior sale volando hacia arriba a la izquierda.
function CartaSaliente({ carta, onFin }) {
  const grupo = useRef();
  const tiempo = useRef(0);
  const terminado = useRef(false);
  const cara = useMemo(() => getCardFaceTexture(carta.info), [carta]);
  const dorso = useMemo(() => getCardBackTexture(), []);

  useFrame((_, delta) => {
    const g = grupo.current;
    if (!g) return;
    tiempo.current += delta;
    const k = Math.min(1, tiempo.current / 0.5);
    g.position.set(-2.8 * k, 0.9 * k, 0);
    g.rotation.set(0, 1.2 * k, 0.6 * k);
    g.scale.setScalar(1.55 * (1 - k * 0.8));
    if (k >= 1 && !terminado.current) {
      terminado.current = true;
      onFin();
    }
  });

  return (
    <group ref={grupo}>
      <CartaMesh cara={cara} dorso={dorso} />
    </group>
  );
}

// Escena de revelado: la carta actual en el centro y el montón de las que quedan a un lado.
export default function RevealStage({ cartas, indice, onAvanzar, conEfectos }) {
  const actual = cartas[indice];
  const [saliente, setSaliente] = useState(null);
  const previa = useRef(null);
  const dorso = useMemo(() => getCardBackTexture(), []);

  useEffect(() => {
    if (previa.current && previa.current.indice !== indice) setSaliente(previa.current);
    previa.current = { indice, carta: actual };
  }, [indice]); // eslint-disable-line react-hooks/exhaustive-deps

  const restantes = Math.max(0, cartas.length - indice - 1);

  return (
    <group position={[0, 1.5, 0]}>
      {saliente && (
        <CartaSaliente key={`s${saliente.indice}`} carta={saliente.carta} onFin={() => setSaliente(null)} />
      )}
      {actual && <CartaActual key={indice} carta={actual} conEfectos={conEfectos} onAvanzar={onAvanzar} />}
      {restantes > 0 && (
        <mesh position={[2.6, -0.9, -0.3]} rotation={[-0.2, -0.4, 0.05]} scale={0.8}>
          <boxGeometry args={[1.4, 1.96, restantes * 0.03]} />
          <meshStandardMaterial map={dorso} roughness={0.6} />
        </mesh>
      )}
    </group>
  );
}
