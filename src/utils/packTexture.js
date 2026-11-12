import { CanvasTexture, SRGBColorSpace } from 'three';
import { loadRemoteTexture } from './imageLoader.js';

// Arte de los sobres. Si hay proxy y el producto tiene config.art_url, se usa la imagen real;
// si no (o si falla), se dibuja un sobre por código. Nada de esto necesita CORS.
const ANCHO = 360;
const ALTO = 640;
const FUENTE = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const ETIQUETAS = {
  booster: 'BOOSTER PACK',
  extra_booster: 'EXTRA BOOSTER',
  premium_booster: 'PREMIUM BOOSTER',
  starter_deck: 'STARTER DECK',
};

const frentes = new Map();
const dorsos = new Map();
const etiquetas = new Map();

function lienzo(ancho = ANCHO, alto = ALTO) {
  const c = document.createElement('canvas');
  c.width = ancho;
  c.height = alto;
  return c;
}

function aTextura(canvas) {
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function tono(texto) {
  let h = 0;
  String(texto).split('').forEach((ch) => { h = (h * 31 + ch.charCodeAt(0)) % 360; });
  return h;
}

function colorBase(producto) {
  switch (producto.kind) {
    case 'extra_booster': return 32;
    case 'premium_booster': return 272;
    case 'starter_deck': return 150;
    default: return tono(producto.set_id ?? producto.product_id);
  }
}

function sellado(ctx, y, alto) {
  ctx.fillStyle = '#cfd4dc';
  ctx.fillRect(0, y, ANCHO, alto);
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 1.5;
  for (let x = 0; x < ANCHO; x += 6) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + alto);
    ctx.stroke();
  }
}

function fondo(ctx, hue) {
  const g = ctx.createLinearGradient(0, 0, ANCHO, ALTO);
  g.addColorStop(0, `hsl(${hue}, 72%, 46%)`);
  g.addColorStop(0.55, `hsl(${hue}, 66%, 28%)`);
  g.addColorStop(1, `hsl(${(hue + 40) % 360}, 70%, 16%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ANCHO, ALTO);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  for (let i = -2; i < 6; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * 90, 0);
    ctx.lineTo(i * 90 + 40, 0);
    ctx.lineTo(i * 90 + 300, ALTO);
    ctx.lineTo(i * 90 + 260, ALTO);
    ctx.closePath();
    ctx.fill();
  }
}

function lineas(ctx, texto, x, y, anchoMax, alturaLinea, maxLineas) {
  const salida = [];
  let actual = '';
  String(texto).split(' ').forEach((palabra) => {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width > anchoMax && actual) {
      salida.push(actual);
      actual = palabra;
    } else {
      actual = prueba;
    }
  });
  if (actual) salida.push(actual);
  salida.slice(0, maxLineas).forEach((l, i) => ctx.fillText(l, x, y + i * alturaLinea));
}

function dibujarFrente(ctx, producto) {
  fondo(ctx, colorBase(producto));
  sellado(ctx, 0, 40);
  sellado(ctx, ALTO - 40, 40);
  ctx.strokeStyle = 'rgba(232,176,74,0.9)';
  ctx.lineWidth = 6;
  ctx.strokeRect(18, 58, ANCHO - 36, ALTO - 116);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 22px ${FUENTE}`;
  ctx.fillText('ONE PIECE CARD GAME', ANCHO / 2, 94);

  const codigo = String(producto.set_id ?? producto.product_id);
  let tam = 88;
  ctx.font = `bold ${tam}px ${FUENTE}`;
  while (ctx.measureText(codigo).width > 300 && tam > 30) {
    tam -= 4;
    ctx.font = `bold ${tam}px ${FUENTE}`;
  }
  ctx.fillStyle = '#ffd24a';
  ctx.fillText(codigo, ANCHO / 2, 290);

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 26px ${FUENTE}`;
  lineas(ctx, producto.name ?? '', ANCHO / 2, 380, ANCHO - 70, 32, 3);

  ctx.fillStyle = '#e8b04a';
  ctx.font = `bold 20px ${FUENTE}`;
  ctx.fillText(ETIQUETAS[producto.kind] ?? 'PACK', ANCHO / 2, ALTO - 78);
}

function dibujarDorso(ctx, producto) {
  fondo(ctx, (colorBase(producto) + 20) % 360);
  sellado(ctx, 0, 40);
  sellado(ctx, ALTO - 40, 40);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e8b04a';
  ctx.font = `bold 34px ${FUENTE}`;
  ctx.fillText('ONE PIECE', ANCHO / 2, ALTO / 2 - 22);
  ctx.fillText('TCG IDLE', ANCHO / 2, ALTO / 2 + 22);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = `16px ${FUENTE}`;
  ctx.fillText(String(producto.name ?? ''), ANCHO / 2, ALTO / 2 + 70);
}

export function getPackArtTexture(producto) {
  const clave = producto.product_id;
  if (frentes.has(clave)) return frentes.get(clave);
  const c = lienzo();
  dibujarFrente(c.getContext('2d'), producto);
  const t = aTextura(c);
  frentes.set(clave, t);
  return t;
}

export function getPackBackTexture(producto) {
  const clave = producto.product_id;
  if (dorsos.has(clave)) return dorsos.get(clave);
  const c = lienzo();
  dibujarDorso(c.getContext('2d'), producto);
  const t = aTextura(c);
  dorsos.set(clave, t);
  return t;
}

// Imagen real del sobre (si hay proxy y el producto tiene art_url). Devuelve null si no.
export function loadRealPackTexture(producto) {
  return loadRemoteTexture(producto.config?.art_url);
}

function rectRedondeado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Etiqueta con el nombre y la cantidad, para colocar en la mesa junto a cada pila.
export function getLabelTexture(texto) {
  if (etiquetas.has(texto)) return etiquetas.get(texto);
  const c = lienzo(256, 64);
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(15,23,32,0.88)';
  rectRedondeado(ctx, 2, 2, 252, 60, 14);
  ctx.fill();
  ctx.strokeStyle = '#e8b04a';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 28px ${FUENTE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, 128, 34);
  const t = aTextura(c);
  etiquetas.set(texto, t);
  return t;
}
