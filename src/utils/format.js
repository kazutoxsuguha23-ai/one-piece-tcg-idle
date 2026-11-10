// Formato de cantidades grandes: 1.234 -> 1.23K, 5.000.000 -> 5M, etc.
const SUFIJOS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

function recortar(numero, decimales) {
  const texto = numero.toFixed(decimales);
  return texto.includes('.') ? texto.replace(/\.?0+$/, '') : texto;
}

export function formatNumber(valor, decimales = 2) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '0';
  if (n < 0) return `-${formatNumber(-n, decimales)}`;
  if (n < 1000) return recortar(n, decimales) || '0';

  let indice = Math.floor(Math.log10(n) / 3);
  if (indice >= SUFIJOS.length) return n.toExponential(2).replace('e+', 'e');
  let reducido = n / 10 ** (indice * 3);
  if (Number(reducido.toFixed(decimales)) >= 1000 && indice + 1 < SUFIJOS.length) {
    indice += 1;
    reducido = n / 10 ** (indice * 3);
  }
  return `${recortar(reducido, decimales)}${SUFIJOS[indice]}`;
}

export function formatDuration(segundos) {
  const s = Math.max(0, Math.floor(Number(segundos) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}
