import { SRGBColorSpace, TextureLoader } from 'three';
import { IMAGE_PROXY_URL } from '../imageConfig.js';

const cache = new Map();

// Carga una imagen externa como textura 3D pasando por el proxy (que añade CORS).
// Devuelve null si no hay proxy configurado o si la imagen falla: el llamador usa su versión dibujada.
export function loadRemoteTexture(url) {
  if (!IMAGE_PROXY_URL || !url) return Promise.resolve(null);
  if (cache.has(url)) return cache.get(url);
  const promesa = new Promise((resolve) => {
    new TextureLoader()
      .setCrossOrigin('anonymous')
      .load(
        `${IMAGE_PROXY_URL}?url=${encodeURIComponent(url)}`,
        (textura) => {
          textura.colorSpace = SRGBColorSpace;
          textura.anisotropy = 4;
          resolve(textura);
        },
        undefined,
        () => resolve(null),
      );
  });
  cache.set(url, promesa);
  return promesa;
}
