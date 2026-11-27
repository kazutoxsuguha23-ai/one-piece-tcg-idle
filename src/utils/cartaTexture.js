// Dibuja una "cartita": papel blanco con un título, un texto y una firma. Se usa para las cartas especiales
// (las que en la base de datos llevan meta.carta = true). Devuelve un <canvas> con la proporción de una carta (5:7).
const ANCHO = 640;
const ALTO = 896;
const TINTA = '#3a2b2f';
const ROSA = '#c2417a';
const FUENTE = '"Segoe Script", "Bradley Hand", "Snell Roundhand", "Comic Sans MS", "Brush Script MT", cursive, serif';

function corazon(ctx, x, y, tam, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(tam, tam);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0.7);
  ctx.bezierCurveTo(-1.2, -0.1, -0.7, -0.9, 0, -0.3);
  ctx.bezierCurveTo(0.7, -0.9, 1.2, -0.1, 0, 0.7);
  ctx.fill();
  ctx.restore();
}

// Parte un texto en líneas que quepan en `anchoMax`. Respeta los saltos de línea (\n).
export function partirLineas(ctx, texto, anchoMax) {
  const lineas = [];
  String(texto ?? '').split('\n').forEach((parrafo) => {
    if (parrafo.trim() === '') {
      lineas.push('');
      return;
    }
    let actual = '';
    parrafo.split(' ').forEach((palabra) => {
      const prueba = actual ? `${actual} ${palabra}` : palabra;
      if (ctx.measureText(prueba).width > anchoMax && actual) {
        lineas.push(actual);
        actual = palabra;
      } else {
        actual = prueba;
      }
    });
    if (actual) lineas.push(actual);
  });
  return lineas;
}

export function dibujarCarta(info) {
  const c = document.createElement('canvas');
  c.width = ANCHO;
  c.height = ALTO;
  const ctx = c.getContext('2d');

  // Papel
  const papel = ctx.createLinearGradient(0, 0, 0, ALTO);
  papel.addColorStop(0, '#fffefb');
  papel.addColorStop(1, '#fbf2e2');
  ctx.fillStyle = papel;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  // Marco doble rosa y corazones en las esquinas
  ctx.strokeStyle = '#f3b6cf';
  ctx.lineWidth = 8;
  ctx.strokeRect(20, 20, ANCHO - 40, ALTO - 40);
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 36, ANCHO - 72, ALTO - 72);
  [[56, 56], [ANCHO - 56, 56], [56, ALTO - 56], [ANCHO - 56, ALTO - 56]].forEach(([x, y]) => corazon(ctx, x, y, 14, '#f3b6cf'));

  // Título
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = ROSA;
  ctx.font = `bold 44px ${FUENTE}`;
  const titulo = String(info.name ?? '');
  let tamTitulo = 44;
  while (ctx.measureText(titulo).width > ANCHO - 140 && tamTitulo > 24) {
    tamTitulo -= 2;
    ctx.font = `bold ${tamTitulo}px ${FUENTE}`;
  }
  ctx.fillText(titulo, ANCHO / 2, 112);
  corazon(ctx, ANCHO / 2, 160, 12, ROSA);

  // Texto: se busca el tamaño de letra más grande que quepa
  const izquierda = 72;
  const anchoTexto = ANCHO - 2 * izquierda;
  const arriba = 205;
  const alto = ALTO - 205 - (info.firma ? 130 : 80);
  let tam = 40;
  let lineas = [];
  for (; tam >= 18; tam -= 2) {
    ctx.font = `${tam}px ${FUENTE}`;
    lineas = partirLineas(ctx, info.text, anchoTexto);
    if (lineas.length * tam * 1.4 <= alto) break;
  }
  ctx.font = `${tam}px ${FUENTE}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const interlineado = tam * 1.4;
  const maxLineas = Math.floor(alto / interlineado);
  lineas.slice(0, maxLineas).forEach((linea, i) => {
    const y = arriba + (i + 1) * interlineado;
    ctx.strokeStyle = 'rgba(194, 65, 122, 0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(izquierda, y + 8);
    ctx.lineTo(ANCHO - izquierda, y + 8);
    ctx.stroke();
    ctx.fillStyle = TINTA;
    ctx.fillText(linea, izquierda, y);
  });

  // Firma
  if (info.firma) {
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = ROSA;
    ctx.font = `italic 30px ${FUENTE}`;
    ctx.fillText(String(info.firma), ANCHO - 84, ALTO - 92);
  }
  return c;
}
