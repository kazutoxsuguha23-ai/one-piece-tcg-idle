// Color de resplandor según rareza / variante (el mismo criterio que los efectos de la mesa).
export function colorRareza(info) {
  if (info.carta) return '#ff9ec7';
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

// Efecto visual 3D del revelado según la rareza / variante (antes vivía en Card3D.jsx).
export function tipoEfecto(c) {
  if (c.carta) return { color: '#ff9ec7', chispas: 14 };
  if (c.manga) return { color: '#ff5fa2', chispas: 26 };
  if (c.sp) return { color: '#6fd8ff', chispas: 22 };
  if (c.rarity === 'SEC' || c.rarity === 'TR') return { color: '#ffd24a', chispas: 20 };
  if (c.rarity === 'SR') return { color: '#cfd8e3', chispas: 10 };
  if (c.alt) return { color: '#b48cff', chispas: 8 };
  return null;
}
