import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import { AdditiveBlending } from 'three';
import { getCardBackTexture, getCardFaceTexture, getGlowTexture } from '../../utils/cardTexture.js';

// Efecto visual según la rareza / variante de la carta.
export function tipoEfecto(c) {
  if (c.manga) return { color: '#ff5fa2', chispas: 26 };
  if (c.sp) return { color: '#6fd8ff', chispas: 22 };
  if (c.rarity === 'SEC' || c.rarity === 'TR') return { color: '#ffd24a', chispas: 20 };
  if (c.rarity === 'SR') return { color: '#cfd8e3', chispas: 10 };
  if (c.alt) return { color: '#b48cff', chispas: 8 };
  return null;
}

const ALTURA_BASE = 0.03;

// Carta tumbada sobre la mesa. Al pasar el ratón (o seleccionarla) se levanta y se inclina hacia ti.
export default function Card3D({ info, x, z, giro, seleccionada, conChispas, onSelect }) {
  const grupo = useRef();
  const halo = useRef();
  const [encima, setEncima] = useState(false);
  const cara = useMemo(() => getCardFaceTexture(info), [info]);
  const dorso = useMemo(() => getCardBackTexture(), []);
  const brillo = useMemo(() => getGlowTexture(), []);
  const efecto = tipoEfecto(info);
  const levantada = encima || seleccionada;

  useFrame((estado, delta) => {
    const g = grupo.current;
    if (!g) return;
    const paso = Math.min(1, delta * 10);
    g.position.y += ((levantada ? ALTURA_BASE + 0.55 : ALTURA_BASE) - g.position.y) * paso;
    g.rotation.x += ((levantada ? -Math.PI / 2 + 0.45 : -Math.PI / 2) - g.rotation.x) * paso;
    if (halo.current) halo.current.material.opacity = 0.6 + Math.sin(estado.clock.elapsedTime * 2.2) * 0.2;
  });

  return (
    <group
      ref={grupo}
      position={[x, ALTURA_BASE, z]}
      rotation={[-Math.PI / 2, 0, giro]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setEncima(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setEncima(false);
        document.body.style.cursor = 'auto';
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(info.card_id);
      }}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.4, 1.96, 0.03]} />
        <meshStandardMaterial attach="material-0" color="#e8e4d8" />
        <meshStandardMaterial attach="material-1" color="#e8e4d8" />
        <meshStandardMaterial attach="material-2" color="#e8e4d8" />
        <meshStandardMaterial attach="material-3" color="#e8e4d8" />
        <meshStandardMaterial attach="material-4" map={cara} roughness={0.45} metalness={0.05} />
        <meshStandardMaterial attach="material-5" map={dorso} roughness={0.6} />
      </mesh>

      {efecto && (
        <mesh ref={halo} position={[0, 0, -0.02]}>
          <planeGeometry args={[1.85, 2.45]} />
          <meshBasicMaterial map={brillo} color={efecto.color} transparent opacity={0.6} blending={AdditiveBlending} depthWrite={false} />
        </mesh>
      )}
      {efecto && conChispas && (
        <Sparkles count={efecto.chispas} scale={[1.8, 2.3, 1.4]} position={[0, 0, 0.7]} size={4} speed={0.5} color={efecto.color} />
      )}
    </group>
  );
}
