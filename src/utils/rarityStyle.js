// Color de resplandor según rareza / variante (el mismo criterio que los efectos de la mesa).
export function colorRareza(info) {
  if (info.manga) return '#ff5fa2';
  if (info.sp) return '#6fd8ff';
  if (info.rarity === 'SEC' || info.rarity === 'TR') return '#ffd24a';
  if (info.rarity === 'SR') return '#cfd8e3';
  if (info.alt) return '#b48cff';
  return null;
}

export function etiquetaVariante(info) {
  return `${info.rarity}${info.manga ? ' · Manga' : info.sp ? ' · SP' : info.alt ? ' · Arte alternativo' : ''}`;
}
