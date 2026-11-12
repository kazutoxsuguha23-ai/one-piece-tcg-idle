import { useEffect, useMemo, useState } from 'react';
import { BoxGeometry, MeshStandardMaterial } from 'three';
import {
  getLabelTexture, getPackArtTexture, getPackBackTexture, loadRealPackTexture,
} from '../../utils/packTexture.js';
import { PACK_H, PACK_W } from './PackModel.jsx';

// Geometría y material del borde compartidos por todos los sobres de la mesa (muy ligero).
const GEO = new BoxGeometry(PACK_W, 0.1, PACK_H);
const BORDE = new MeshStandardMaterial({ color: '#aab1bd', roughness: 0.4, metalness: 0.15 });

// Pila de sobres tumbados sobre la mesa (hasta 7 visibles) con su etiqueta delante.
export default function PackPile({ producto, cantidad, x, z, onSelect }) {
  const [frente, setFrente] = useState(() => getPackArtTexture(producto));
  const dorso = useMemo(() => getPackBackTexture(producto), [producto]);
  const [encima, setEncima] = useState(false);

  useEffect(() => {
    let vivo = true;
    loadRealPackTexture(producto).then((t) => {
      if (vivo && t) setFrente(t);
    });
    return () => { vivo = false; };
  }, [producto]);

  useEffect(() => () => { document.body.style.cursor = 'auto'; }, []);

  const materiales = useMemo(
    () => [
      BORDE,
      BORDE,
      new MeshStandardMaterial({ map: frente, roughness: 0.4, metalness: 0.1 }),
      new MeshStandardMaterial({ map: dorso, roughness: 0.5 }),
      BORDE,
      BORDE,
    ],
    [frente, dorso],
  );
  useEffect(() => () => { materiales[2].dispose(); materiales[3].dispose(); }, [materiales]);

  const etiqueta = useMemo(
    () => getLabelTexture(`${producto.set_id ?? producto.product_id}  ×${cantidad}`),
    [producto, cantidad],
  );
  const visibles = Math.min(cantidad, 7);

  return (
    <group
      position={[x, 0, z]}
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
        onSelect(producto.product_id);
      }}
    >
      {Array.from({ length: visibles }, (_, i) => (
        <mesh
          key={i}
          geometry={GEO}
          material={materiales}
          position={[
            Math.sin(i * 12.9898) * 0.04,
            0.06 + i * 0.1 + (i === visibles - 1 && encima ? 0.14 : 0),
            Math.cos(i * 78.233) * 0.04,
          ]}
          rotation={[0, Math.sin(i * 4.1) * 0.07, 0]}
          castShadow
          receiveShadow
        />
      ))}
      <mesh position={[0, 0.02, PACK_H / 2 + 0.2]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[1.1, 0.275]} />
        <meshBasicMaterial map={etiqueta} transparent />
      </mesh>
    </group>
  );
}
