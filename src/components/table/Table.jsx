import { useEffect, useMemo } from 'react';
import { makeFeltTexture, makeWoodTexture } from '../../utils/proceduralTextures.js';
import { getCardBackTexture } from '../../utils/cardTexture.js';

// Mesa de juego: fieltro, borde de madera, cuerpo, suelo y un mazo decorativo.
export default function Table() {
  const fieltro = useMemo(() => makeFeltTexture(), []);
  const madera = useMemo(() => makeWoodTexture(), []);
  const dorso = useMemo(() => getCardBackTexture(), []);

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

      {[[0, -3.4, 11.8, 0.6], [0, 3.4, 11.8, 0.6]].map(([x, z, ancho, fondo]) => (
        <mesh key={`h${z}`} position={[x, 0.05, z]} castShadow receiveShadow>
          <boxGeometry args={[ancho, 0.25, fondo]} />
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

      {/* Mazo decorativo */}
      <mesh position={[-4.0, 0.18, -1.3]} rotation-y={0.12} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.34, 1.96]} />
        <meshStandardMaterial attach="material-0" color="#e8e4d8" />
        <meshStandardMaterial attach="material-1" color="#e8e4d8" />
        <meshStandardMaterial attach="material-2" map={dorso} roughness={0.6} />
        <meshStandardMaterial attach="material-3" color="#e8e4d8" />
        <meshStandardMaterial attach="material-4" color="#e8e4d8" />
        <meshStandardMaterial attach="material-5" color="#e8e4d8" />
      </mesh>
    </group>
  );
}
