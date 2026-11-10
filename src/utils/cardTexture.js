import { CanvasTexture, SRGBColorSpace } from 'three';

// Dibuja una carta con su nombre, rareza, coste y poder. No usa imágenes externas,
// así que funciona sin CORS y también para las cartas que no tienen imagen.
const COLORES = {
  red: '#c0392b', green: '#2e8b57', blue: '#2f6fb5', purple: '#7d4cb0', black: '#2b2b33', yellow: '#d4a72c',
};
const COLOR_RAREZA = {
  C: '#b0b7c0', UC: '#6fcf97', R: '#4aa3ff', SR: '#ffd24a', SEC: '#ff6b6b', L: '#e8b04a',
  TR: '#c77dff', SP: '#7ad7ff', PR: '#f2994a', P: '#f2994a', DON: '#9aa5b1',
};
const FUENTE = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const ANCHO = 320;
const ALTO = 448;

const cache = new Map();

function lienzo() {
  const c = document.createElement('canvas');
  c.width = ANCHO;
  c.height = ALTO;
  return c;
}

function colorCarta(color) {
  const primero = String(color ?? '').toLowerCase().split(/[\/ ]/)[0];
  return COLORES[primero] ?? '#6c7a89';
}

function escribirEnLineas(ctx, texto, x, y, anchoMax, alturaLinea, maxLineas) {
  const lineas = [];
  let actual = '';
  String(texto).split(' ').forEach((palabra) => {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width > anchoMax && actual) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = prueba;
    }
  });
  if (actual) lineas.push(actual);
  lineas.slice(0, maxLineas).forEach((linea, i) => ctx.fillText(linea, x, y + i * alturaLinea));
}

function aTextura(canvas) {
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function getCardFaceTexture(carta) {
  const clave = carta.id ?? carta.card_id;
  if (cache.has(clave)) return cache.get(clave);

  const c = lienzo();
  const ctx = c.getContext('2d');
  const principal = colorCarta(carta.color);
  const rareza = COLOR_RAREZA[carta.rarity] ?? '#c0c8d0';

  const degradado = ctx.createLinearGradient(0, 0, 0, ALTO);
  degradado.addColorStop(0, principal);
  degradado.addColorStop(1, '#10151d');
  ctx.fillStyle = degradado;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  ctx.lineWidth = 12;
  ctx.strokeStyle = rareza;
  ctx.strokeRect(6, 6, ANCHO - 12, ALTO - 12);

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(24, 74, ANCHO - 48, 196);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.font = `bold 150px ${FUENTE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(carta.name ?? '?').charAt(0).toUpperCase(), ANCHO / 2, 172);

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 26px ${FUENTE}`;
  ctx.textBaseline = 'top';
  escribirEnLineas(ctx, carta.name ?? '', ANCHO / 2, 284, ANCHO - 48, 30, 2);

  if (carta.cost !== null && carta.cost !== undefined) {
    ctx.fillStyle = '#0d1117';
    ctx.beginPath();
    ctx.arc(46, 44, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 26px ${FUENTE}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(String(carta.cost), 46, 45);
  }
  if (carta.power !== null && carta.power !== undefined) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 28px ${FUENTE}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(carta.power), ANCHO - 28, 45);
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#d7dde5';
  ctx.font = `14px ${FUENTE}`;
  ctx.fillText(String(carta.id ?? ''), 24, ALTO - 30);

  const variante = carta.manga ? 'MANGA' : carta.sp ? 'SP' : carta.alt ? 'ALT ART' : '';
  if (variante) {
    ctx.textAlign = 'center';
    ctx.fillStyle = rareza;
    ctx.font = `bold 15px ${FUENTE}`;
    ctx.fillText(variante, ANCHO / 2, ALTO - 62);
  }

  ctx.fillStyle = rareza;
  ctx.fillRect(ANCHO - 84, ALTO - 48, 60, 28);
  ctx.fillStyle = '#10151d';
  ctx.font = `bold 18px ${FUENTE}`;
  ctx.textAlign = 'center';
  ctx.fillText(String(carta.rarity ?? ''), ANCHO - 54, ALTO - 34);

  const textura = aTextura(c);
  cache.set(clave, textura);
  return textura;
}

let dorso = null;
export function getCardBackTexture() {
  if (dorso) return dorso;
  const c = lienzo();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#16233a';
  ctx.fillRect(0, 0, ANCHO, ALTO);
  ctx.strokeStyle = '#e8b04a';
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, ANCHO - 12, ALTO - 12);
  ctx.strokeStyle = 'rgba(232,176,74,0.25)';
  ctx.lineWidth = 2;
  for (let i = -ALTO; i < ANCHO; i += 28) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + ALTO, ALTO);
    ctx.stroke();
  }
  ctx.fillStyle = '#e8b04a';
  ctx.font = `bold 34px ${FUENTE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ONE PIECE', ANCHO / 2, ALTO / 2 - 22);
  ctx.fillText('TCG IDLE', ANCHO / 2, ALTO / 2 + 22);
  dorso = aTextura(c);
  return dorso;
}
