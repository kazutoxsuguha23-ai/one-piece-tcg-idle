import { SRGBColorSpace, TextureLoader } from 'three';
import { IMAGE_PROXY_URL } from '../imageConfig.js';

// Carga imágenes externas (cartas, sobres) como texturas 3D pasando por el proxy (que añade CORS).
// Devuelve null si no hay proxy configurado o si la imagen falla: el llamador usa su versión dibujada.
//
// Memoria: cada textura ocupa memoria de la tarjeta gráfica. Solo se guardan las últimas MAX_TEXTURAS;
// las más antiguas se liberan (si se vuelven a necesitar, se vuelven a descargar, desde la caché del proxy).
const MAX_TEXTURAS = 40;
const REINTENTO_MS = 60000;

const promesas = new Map(); // url -> Promise<Texture | null> (cargas en curso o terminadas)
const listas = new Map(); // url -> Texture ya cargada (la más antigua primero)
const fallos = new Map(); // url -> momento del último fallo

function olvidarAntiguas() {
  while (listas.size > MAX_TEXTURAS) {
    const [url, textura] = listas.entries().next().value;
    listas.delete(url);
    promesas.delete(url);
    textura.dispose();
  }
}

// Textura ya cargada (sin esperar), o null. Sirve para que la carta salga con su imagen desde el primer fotograma.
export function getTexturaCargada(url) {
  const textura = url ? listas.get(url) : null;
  if (!textura) return null;
  listas.delete(url); // se marca como usada hace poco
  listas.set(url, textura);
  return textura;
}

export function loadRemoteTexture(url) {
  if (!IMAGE_PROXY_URL || !url) return Promise.resolve(null);
  const hecha = getTexturaCargada(url);
  if (hecha) return Promise.resolve(hecha);
  if (promesas.has(url)) return promesas.get(url);
  if (Date.now() - (fallos.get(url) ?? 0) < REINTENTO_MS) return Promise.resolve(null);

  const promesa = new Promise((resolve) => {
    new TextureLoader()
      .setCrossOrigin('anonymous')
      .load(
        `${IMAGE_PROXY_URL}?url=${encodeURIComponent(url)}`,
        (textura) => {
          textura.colorSpace = SRGBColorSpace;
          textura.anisotropy = 4;
          listas.set(url, textura);
          olvidarAntiguas();
          resolve(textura);
        },
        undefined,
        () => {
          promesas.delete(url);
          fallos.set(url, Date.now());
          resolve(null);
        },
      );
  });
  promesas.set(url, promesa);
  return promesa;
}

// Descarga varias imágenes a la vez y espera a que terminen (máximo `limiteMs`, para no quedarse parado
// si alguna tarda). Nunca falla: lo que no llegue a tiempo se sigue cargando y aparece después.
export function precargarImagenes(urls, limiteMs = 5000) {
  if (!IMAGE_PROXY_URL) return Promise.resolve();
  const unicas = [...new Set(urls)].filter(Boolean);
  if (unicas.length === 0) return Promise.resolve();
  let temporizador;
  const espera = new Promise((resolver) => { temporizador = setTimeout(resolver, limiteMs); });
  return Promise.race([Promise.all(unicas.map((u) => loadRemoteTexture(u))), espera]).then(() => {
    clearTimeout(temporizador);
  });
}
