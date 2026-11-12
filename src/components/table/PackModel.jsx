import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export const PACK_W = 1.1;
export const PACK_H = 1.9;
export const PACK_T = 0.1;
export const PACK_TAPA = 0.3;

// Una copia de la textura que solo enseña la franja desde..hasta (0 = abajo, 1 = arriba).
function cortar(textura, desde, hasta) {
  const t = textura.clone();
  t.repeat.set(1, hasta - desde);
  t.offset.set(0, desde);
  t.needsUpdate = true;
  return t;
}

const BORDE = { color: '#aab1bd', metalness: 0.15, roughness: 0.4 };

// Sobre de 2 piezas: el cuerpo y la tapa superior, que se rasga. `estado` es una referencia con
// { p: progreso del rasgado 0..1, dir: -1 | 1, vuelo: 0..1 una vez roto }.
export default function PackModel({ textura, dorso, estado }) {
  const tapa = useRef();
  const fraccion = (PACK_H - PACK_TAPA) / PACK_H;

  const cuerpoFrente = useMemo(() => cortar(textura, 0, fraccion), [textura, fraccion]);
  const tapaFrente = useMemo(() => cortar(textura, fraccion, 1), [textura, fraccion]);
  const cuerpoDorso = useMemo(() => cortar(dorso, 0, fraccion), [dorso, fraccion]);
  const tapaDorso = useMemo(() => cortar(dorso, fraccion, 1), [dorso, fraccion]);

  useEffect(
    () => () => {
      [cuerpoFrente, tapaFrente, cuerpoDorso, tapaDorso].forEach((t) => t.dispose());
    },
    [cuerpoFrente, tapaFrente, cuerpoDorso, tapaDorso],
  );

  useFrame(() => {
    const t = tapa.current;
    if (!t) return;
    const { p, vuelo } = estado.current;
    const dir = estado.current.dir || 1;
    t.position.set(
      dir * (p * 0.75 + vuelo * 2.4),
      PACK_H / 2 - PACK_TAPA / 2 + p * 0.12 + vuelo * 1.0,
      vuelo * 0.7,
    );
    t.rotation.set(vuelo * 2.2, vuelo * 1.5, -dir * (p * 0.35 + vuelo * 1.2));
    t.visible = vuelo < 1;
  });

  return (
    <group>
      <mesh position={[0, -PACK_TAPA / 2, 0]} castShadow>
        <boxGeometry args={[PACK_W, PACK_H - PACK_TAPA, PACK_T]} />
        <meshStandardMaterial attach="material-0" {...BORDE} />
        <meshStandardMaterial attach="material-1" {...BORDE} />
        <meshStandardMaterial attach="material-2" color="#0a0a0d" />
        <meshStandardMaterial attach="material-3" {...BORDE} />
        <meshStandardMaterial attach="material-4" map={cuerpoFrente} roughness={0.35} metalness={0.1} />
        <meshStandardMaterial attach="material-5" map={cuerpoDorso} roughness={0.45} metalness={0.1} />
      </mesh>
      <group ref={tapa} position={[0, PACK_H / 2 - PACK_TAPA / 2, 0]}>
        <mesh castShadow>
          <boxGeometry args={[PACK_W, PACK_TAPA, PACK_T]} />
          <meshStandardMaterial attach="material-0" {...BORDE} />
          <meshStandardMaterial attach="material-1" {...BORDE} />
          <meshStandardMaterial attach="material-2" {...BORDE} />
          <meshStandardMaterial attach="material-3" {...BORDE} />
          <meshStandardMaterial attach="material-4" map={tapaFrente} roughness={0.35} metalness={0.1} />
          <meshStandardMaterial attach="material-5" map={tapaDorso} roughness={0.45} metalness={0.1} />
        </mesh>
      </group>
    </group>
  );
}
