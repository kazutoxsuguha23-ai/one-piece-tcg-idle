import { supabase } from './supabaseClient.js';

// El catálogo de la web (cards.json) solo trae las cartas de la API. Las cartas que no estén ahí (por ejemplo
// las "cartitas" del sobre secreto, que viven solo en la base de datos) se piden aquí y se añaden al catálogo
// en memoria. Así el álbum, la mesa y los resultados las tratan como a cualquier otra carta.
function infoDeFila(f) {
  const m = f.meta ?? {};
  const esCarta = m.carta === true;
  return {
    id: f.card_id,
    code: f.code ?? f.card_id,
    image_id: f.card_id,
    set: f.set_id,
    name: esCarta ? (m.titulo ?? f.name) : f.name,
    rarity: f.rarity,
    rarity_name: m.rarity_name ?? f.rarity,
    type: f.card_type,
    color: null,
    cost: null,
    power: null,
    counter: null,
    life: null,
    attribute: null,
    subtypes: null,
    text: esCarta ? (m.texto ?? '') : null,
    image: '',
    variant: f.variant ?? 'base',
    labels: m.labels ?? [],
    alt: Boolean(m.alt),
    manga: Boolean(m.manga),
    sp: Boolean(m.sp),
    retired: Boolean(m.retired),
    carta: esCarta,
    firma: esCarta ? (m.firma ?? '') : '',
  };
}

const COLUMNAS = 'card_id, set_id, code, name, rarity, card_type, variant, meta';

// Añade al catálogo (en el sitio) las cartas de `ids` que aún no están. Devuelve true si cambió algo.
export async function completarCatalogo(catalogo, ids) {
  const pedir = [...new Set(ids)].filter((id) => id && !catalogo.byId.has(id)).slice(0, 200);
  if (pedir.length === 0) return false;

  const { data, error } = await supabase.from('catalog_cards').select(COLUMNAS).in('card_id', pedir);
  if (error || !data || data.length === 0) return false;

  // Si el set de esas cartas tampoco está en el catálogo, se trae entero (con su nombre) para el álbum.
  const setsNuevos = [...new Set(data.map((f) => f.set_id))].filter((id) => !catalogo.sets.some((s) => s.id === id));
  let filas = data;
  if (setsNuevos.length > 0) {
    const { data: delSet } = await supabase.from('catalog_cards').select(COLUMNAS).in('set_id', setsNuevos).limit(1000);
    const { data: infoSets } = await supabase.from('catalog_sets').select('set_id, name, kind').in('set_id', setsNuevos);
    filas = [...data, ...(delSet ?? [])];
    setsNuevos.forEach((id) => {
      const s = infoSets?.find((x) => x.set_id === id);
      catalogo.sets.push({ id, name: s?.name ?? id, kind: s?.kind ?? 'other', card_count: 0 });
    });
  }

  let cambio = false;
  filas.forEach((f) => {
    if (catalogo.byId.has(f.card_id)) return;
    const info = infoDeFila(f);
    catalogo.byId.set(info.id, info);
    catalogo.cards.push(info);
    cambio = true;
  });
  setsNuevos.forEach((id) => {
    const s = catalogo.sets.find((x) => x.id === id);
    if (s) s.card_count = catalogo.cards.filter((c) => c.set === id).length;
  });
  return cambio;
}
