import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

// Texturas dibujadas por código (sin descargar nada): fieltro verde y madera.
function lienzo(ancho, alto) {
  const c = document.createElement('canvas');
  c.width = ancho;
  c.height = alto;
  return c;
}

function aTextura(canvas, repeticionX, repeticionY) {
  const t = new CanvasTexture(canvas);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.repeat.set(repeticionX, repeticionY);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function makeFeltTexture() {
  const c = lienzo(512, 512);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1d6a47';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i += 1) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.09)';
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5);
  }
  return aTextura(c, 4, 2.5);
}

export function makeWoodTexture() {
  const c = lienzo(512, 128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5a3a22';
  ctx.fillRect(0, 0, 512, 128);
  for (let y = 0; y < 128; y += 2) {
    const sombra = Math.random() * 0.28;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(0,0,0,${sombra})` : `rgba(255,220,170,${sombra * 0.5})`;
    ctx.fillRect(0, y, 512, 1 + Math.random() * 2);
  }
  return aTextura(c, 3, 1);
}
