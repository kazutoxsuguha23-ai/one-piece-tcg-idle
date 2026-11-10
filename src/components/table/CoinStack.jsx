import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export const WALLET_POS = [4.0, 0, -1.2];

const MATERIAL_ORO = { color: '#ffcf4a', metalness: 0.4, roughness: 0.35, emissive: '#5a3c00', emissiveIntensity: 0.5 };

// Monedero de cuero + pila de monedas que crece con tu saldo (escala logarítmica).
export default function CoinStack({ coins }) {
  const cantidad = Math.max(1, Math.min(36, Math.round(Math.log10(Math.max(Number(coins), 1) + 1) * 6)));
  return (
    <group position={WALLET_POS}>
      <mesh position={[-0.75, 0.35, 0.1]} scale={[1, 0.85, 1]} castShadow>
        <sphereGeometry args={[0.55, 20, 16]} />
        <meshStandardMaterial color="#6b3f1f" roughness={0.9} />
      </mesh>
      <mesh position={[-0.75, 0.86, 0.1]} castShadow>
        <cylinderGeometry args={[0.12, 0.2, 0.2, 12]} />
        <meshStandardMaterial color="#4a2a12" roughness={0.9} />
      </mesh>
      {Array.from({ length: cantidad }, (_, i) => (
        <mesh key={i} position={[0.15 + (i % 2) * 0.02, 0.03 + i * 0.045, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.04, 24]} />
          <meshStandardMaterial {...MATERIAL_ORO} />
        </mesh>
      ))}
      <pointLight position={[0.15, 1.1, 0.5]} color="#ffcf4a" intensity={4} distance={4} />
    </group>
  );
}

// Monedas que vuelan de las cartas al monedero cuando recoges.
export function CoinBurst({ onDone }) {
  const grupo = useRef();
  const tiempo = useRef(0);
  const terminado = useRef(false);
  const monedas = useMemo(
    () => Array.from({ length: 20 }, (_, i) => ({
      retraso: i * 0.035,
      desde: [-3 + Math.random() * 6, 0.35, 0.4 + Math.random() * 1.2],
    })),
    [],
  );

  useFrame((_, delta) => {
    tiempo.current += delta;
    if (!grupo.current) return;
    grupo.current.children.forEach((moneda, i) => {
      const { retraso, desde } = monedas[i];
      const k = Math.min(Math.max((tiempo.current - retraso) / 1.0, 0), 1);
      moneda.position.set(
        desde[0] + (WALLET_POS[0] + 0.15 - desde[0]) * k,
        desde[1] + (WALLET_POS[1] + 0.6 - desde[1]) * k + Math.sin(k * Math.PI) * 1.6,
        desde[2] + (WALLET_POS[2] - desde[2]) * k,
      );
      moneda.rotation.x += delta * 12;
      moneda.visible = k > 0 && k < 1;
    });
    if (tiempo.current > 1.8 && !terminado.current) {
      terminado.current = true;
      onDone();
    }
  });

  return (
    <group ref={grupo}>
      {monedas.map((_, i) => (
        <mesh key={i} visible={false}>
          <cylinderGeometry args={[0.14, 0.14, 0.04, 16]} />
          <meshStandardMaterial {...MATERIAL_ORO} />
        </mesh>
      ))}
    </group>
  );
}
