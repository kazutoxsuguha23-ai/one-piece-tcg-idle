// Lógica pura del álbum: paginación, filtros y orden. Sin React, para poder probarla.
export const POR_PAGINA = 9;

// Orden de rareza (mayor = más rara). Las variantes suman: Manga > SP > Alt.
const RANGO_RAREZA = { DON: 0, C: 1, UC: 2, R: 3, L: 4, PR: 5, P: 5, SR: 5, SEC: 6, SP: 7, TR: 8 };

export function valorRareza(info) {
  return (RANGO_RAREZA[info.rarity] ?? 1) * 10 + (info.manga ? 3 : info.sp ? 2 : info.alt ? 1 : 0);
}

export function dividirEnPaginas(lista, tam = POR_PAGINA) {
  const paginas = [];
  for (let i = 0; i < lista.length; i += tam) paginas.push(lista.slice(i, i + tam));
  return paginas;
}

// Libro de 2 páginas: la 1.ª vista = [hoja en blanco | página 0], luego [1 | 2], [3 | 4]...
// En modo de una sola página (móvil) cada "vista" es una página.
export function totalSpreads(nPaginas, uni) {
  return uni ? Math.max(1, nPaginas) : Math.floor(nPaginas / 2) + 1;
}

export function indicesDeSpread(spread, uni) {
  return uni ? { izq: null, der: spread } : { izq: 2 * spread - 1, der: 2 * spread };
}

export function spreadDePagina(indice, uni) {
  return uni ? indice : Math.ceil(indice / 2);
}

export function rotuloPaginas(spread, nPaginas, uni) {
  if (nPaginas === 0) return 'Sin cartas';
  if (uni) return `Página ${spread + 1} de ${nPaginas}`;
  const { izq, der } = indicesDeSpread(spread, false);
  const a = izq >= 0 ? izq + 1 : null;
  const b = der < nPaginas ? der + 1 : null;
  if (a && b) return `Páginas ${a}–${b} de ${nPaginas}`;
  return `Página ${a ?? b} de ${nPaginas}`;
}

// Las cartas desconocidas no revelan su nombre: la búsqueda por nombre solo encuentra las descubiertas
// (por código se encuentran todas).
export function filtrarYOrdenar(cartas, poseidas, { rareza = '', estado = 'todas', texto = '', orden = 'codigo' } = {}) {
  const t = texto.trim().toLowerCase();
  let items = cartas.map((info, i) => ({ info, poseida: poseidas.get(info.id) ?? null, i }));

  if (rareza.startsWith('r:')) items = items.filter((x) => x.info.rarity === rareza.slice(2));
  else if (rareza === 'v:alt') items = items.filter((x) => x.info.alt && !x.info.manga && !x.info.sp);
  else if (rareza === 'v:manga') items = items.filter((x) => x.info.manga);
  else if (rareza === 'v:sp') items = items.filter((x) => x.info.sp && !x.info.manga);

  if (estado === 'descubiertas') items = items.filter((x) => x.poseida);
  else if (estado === 'desconocidas') items = items.filter((x) => !x.poseida);

  if (t) {
    items = items.filter(
      (x) => x.info.id.toLowerCase().includes(t)
        || x.info.code.toLowerCase().includes(t)
        || (x.poseida && x.info.name.toLowerCase().includes(t)),
    );
  }

  const num = (v) => Number(v ?? 0);
  const orden_ = {
    codigo: (a, b) => a.i - b.i,
    produccion: (a, b) => num(b.poseida?.production_per_sec) - num(a.poseida?.production_per_sec) || a.i - b.i,
    nivel: (a, b) => num(b.poseida?.level) - num(a.poseida?.level) || a.i - b.i,
    copias: (a, b) => num(b.poseida?.copies) - num(a.poseida?.copies) || a.i - b.i,
    rareza: (a, b) => valorRareza(b.info) - valorRareza(a.info) || a.i - b.i,
    nombre: (a, b) => (a.poseida ? 0 : 1) - (b.poseida ? 0 : 1)
      || a.info.name.localeCompare(b.info.name) || a.i - b.i,
  };
  return items.sort(orden_[orden] ?? orden_.codigo);
}
