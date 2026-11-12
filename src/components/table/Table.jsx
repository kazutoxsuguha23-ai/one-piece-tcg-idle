import { useEffect, useMemo } from 'react';
import { makeFeltTexture, makeWoodTexture } from '../../utils/proceduralTextures.js';

// Mesa de juego: fieltro, borde de madera, cuerpo y suelo. Sin nada encima.
export default function Table() {
  const fieltro = useMemo(() => makeFeltTexture(), []);
  const madera = useMemo(() => makeWoodTexture(), []);

  useEffect(() => () => {
    fieltro.dispose();
    madera.dispose();
  }, [fieltro, madera]);

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[11, 6.4]} />
        <meshStandardMaterial map={fieltro} roughness={1} />
      </mesh>

      {[-3.4, 3.4].map((z) => (
        <mesh key={`h${z}`} position={[0, 0.05, z]} castShadow receiveShadow>
          <boxGeometry args={[11.8, 0.25, 0.6]} />
          <meshStandardMaterial map={madera} roughness={0.7} />
        </mesh>
      ))}
      {[-5.7, 5.7].map((x) => (
        <mesh key={`v${x}`} position={[x, 0.05, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.6, 0.25, 7.4]} />
          <meshStandardMaterial map={madera} roughness={0.7} />
        </mesh>
      ))}

      <mesh position={[0, -0.35, 0]} receiveShadow>
        <boxGeometry args={[11.8, 0.6, 7.4]} />
        <meshStandardMaterial map={madera} color="#8a6a50" roughness={0.8} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.66, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#0d1117" roughness={1} />
      </mesh>
    </group>
  );
}
