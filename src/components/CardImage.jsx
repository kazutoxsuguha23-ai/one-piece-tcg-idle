import { useMemo, useState } from 'react';
import { getCardFaceTexture } from '../utils/cardTexture.js';

// Imagen de la carta. Si no existe o falla, se enseña la carta dibujada por código.
// Es una etiqueta <img> normal (no WebGL), así que no necesita CORS ni proxy.
export default function CardImage({ info, className }) {
  const [fallo, setFallo] = useState(!info.image);
  const src = useMemo(
    () => (fallo ? getCardFaceTexture(info).image.toDataURL('image/png') : info.image),
    [fallo, info],
  );
  return (
    <img
      className={className}
      src={src}
      alt={info.name}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFallo(true)}
    />
  );
}
