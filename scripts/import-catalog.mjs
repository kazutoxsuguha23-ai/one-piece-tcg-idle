// Importador del catálogo de One Piece TCG.
// Fuente: optcgapi.com (API pública, solo lectura). Se ejecuta desde GitHub Actions.
// Genera public/data/cards.json y public/data/sets.json y (si hay claves) actualiza las tablas catalog_* de Supabase.
import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const API_BASE = 'https://optcgapi.com/api';
const ENDPOINTS = [
  { path: '/allSetCards/', group: 'set' },
  { path: '/allSTCards/', group: 'starter' },
  { path: '/allPromoCards/', group: 'promo' },
  { path: '/allDonCards/', group: 'don' },
];
const OUT_DIR = 'public/data';
const SOURCE = {
  name: 'optcgapi.com (DomoSlime)',
  url: 'https://optcgapi.com',
  notice:
    'One Piece and the One Piece Card Game data are trademarks of Eiichiro Oda, Bandai, Shonen Jump and Viz Media. Proyecto privado de aficionado.',
};

const RARITY_CODES = {
  common: 'C', uncommon: 'UC', rare: 'R', 'super rare': 'SR', 'secret rare': 'SEC',
  leader: 'L', promo: 'P', special: 'SP', 'special card': 'SP', 'treasure rare': 'TR',
  don: 'DON', 'don!!': 'DON',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- utilidades
export function normalizeSetId(raw) {
  return String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function setKind(setId) {
  if (/^OP\d/.test(setId)) return 'booster';
  if (/^EB\d/.test(setId)) return 'extra_booster';
  if (/^PRB\d/.test(setId)) return 'premium_booster';
  if (/^ST\d/.test(setId)) return 'starter_deck';
  if (setId === 'PROMO' || setId === 'P') return 'promo';
  if (setId === 'DON') return 'don';
  return 'other';
}

function toInt(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = parseInt(String(valor).replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

function normalizeRarity(raw, group) {
  const texto = String(raw ?? '').trim();
  if (!texto) return { code: group === 'don' ? 'DON' : 'UNKNOWN', raw: texto, known: group === 'don' };
  const code = RARITY_CODES[texto.toLowerCase()];
  return { code: code ?? texto, raw: texto, known: Boolean(code) };
}

function parseName(rawName) {
  const nombre = String(rawName ?? '');
  const labels = [...nombre.matchAll(/\(([^)]*)\)/g)]
    .map((m) => m[1].trim())
    .filter((l) => l && !/^\d+$/.test(l));
  const limpio = nombre
    .replace(/\s*\([^)]*\)/g, (grupo) => (/^\(\s*\d+\s*\)$/.test(grupo.trim()) ? grupo : ''))
    .replace(/\s+/g, ' ')
    .trim();
  return { name: limpio || nombre.trim(), labels };
}

// ------------------------------------------------------------- normalización
// Convierte una carta "cruda" de la API en nuestro formato. Devuelve null si no sirve.
export function normalizeCard(raw, group) {
  const code = String(raw.card_set_id ?? '').trim();
  const imageId = String(raw.card_image_id ?? code).trim();
  if (!imageId || !raw.card_name) return null;

  let set;
  let setName;
  if (group === 'promo') { set = 'PROMO'; setName = 'Promos'; }
  else if (group === 'don') { set = 'DON'; setName = 'DON!! Cards'; }
  else {
    set = normalizeSetId(raw.set_id) || normalizeSetId(code.split('-')[0]);
    setName = String(raw.set_name ?? '').trim() || set;
  }
  if (!set) return null;

  const { name, labels } = parseName(raw.card_name);
  const suffix = /_([A-Za-z]+\d*)$/.exec(imageId)?.[1]?.toLowerCase() ?? null;
  const rarity = normalizeRarity(raw.rarity, group);
  const type = String(raw.card_type ?? '').trim().toLowerCase().replace('!!', '') || (group === 'don' ? 'don' : 'unknown');

  return {
    card: {
      code: code || imageId.replace(/_.*$/, ''),
      image_id: imageId,
      set,
      name,
      rarity: rarity.code,
      rarity_name: rarity.raw,
      type,
      color: String(raw.card_color ?? '').trim() || null,
      cost: toInt(raw.card_cost),
      power: toInt(raw.card_power),
      counter: toInt(raw.counter_amount),
      life: toInt(raw.life),
      attribute: String(raw.attribute ?? '').trim() || null,
      subtypes: String(raw.sub_types ?? '').trim() || null,
      text: String(raw.card_text ?? '').trim() || null,
      image: String(raw.card_image ?? '').trim() || `https://optcgapi.com/media/static/Card_Images/${imageId}.jpg`,
      variant: suffix ?? 'base',
      labels,
      alt: labels.some((l) => /alternate art/i.test(l)) || /^p\d+$/.test(suffix ?? ''),
      manga: labels.some((l) => /manga/i.test(l)),
      sp: labels.some((l) => /^sp\b/i.test(l)) || rarity.code === 'SP',
    },
    setName,
    rarityKnown: rarity.known,
  };
}

// Asigna identificadores ESTABLES: una carta que ya tenía id lo conserva siempre.
export function buildCatalog(groups, previousCards = []) {
  const known = new Map(previousCards.map((c) => [`${c.set}|${c.image_id}`, c.id]));
  const usedIds = new Set();
  const seen = new Map();
  const setNames = new Map();
  const stats = { raw: 0, skipped: 0, duplicates: 0, collisions: 0, retired: 0, unknownRarities: {} };

  for (const { group, cards } of groups) {
    for (const rawCard of cards) {
      stats.raw += 1;
      const res = normalizeCard(rawCard, group);
      if (!res) { stats.skipped += 1; continue; }
      const key = `${res.card.set}|${res.card.image_id}`;
      if (seen.has(key)) { stats.duplicates += 1; continue; }
      seen.set(key, res.card);
      if (!setNames.has(res.card.set)) setNames.set(res.card.set, res.setName);
      if (!res.rarityKnown) {
        stats.unknownRarities[res.card.rarity] = (stats.unknownRarities[res.card.rarity] ?? 0) + 1;
      }
    }
  }

  const entries = [...seen.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [key, card] of entries) {
    if (known.has(key)) { card.id = known.get(key); usedIds.add(card.id); }
  }
  for (const [, card] of entries) {
    if (card.id) continue;
    let id = card.image_id;
    if (usedIds.has(id)) { id = `${card.image_id}@${card.set}`; stats.collisions += 1; }
    card.id = id;
    usedIds.add(id);
  }

  const cards = entries.map(([, c]) => c);
  // Cartas que existían antes y ya no vienen en la API: se conservan marcadas como retiradas.
  for (const old of previousCards) {
    if (!usedIds.has(old.id)) { cards.push({ ...old, retired: true }); usedIds.add(old.id); stats.retired += 1; }
  }
  cards.sort((a, b) => a.set.localeCompare(b.set) || a.code.localeCompare(b.code) || a.image_id.localeCompare(b.image_id));

  const counts = {};
  for (const c of cards) counts[c.set] = (counts[c.set] ?? 0) + 1;
  const sets = Object.keys(counts).sort().map((id) => ({
    id, name: setNames.get(id) ?? id, kind: setKind(id), card_count: counts[id],
  }));
  return { cards, sets, stats };
}

function summaryText(cards, sets, stats) {
  const porRareza = {};
  for (const c of cards) porRareza[c.rarity] = (porRareza[c.rarity] ?? 0) + 1;
  const lineas = [
    '## Importación del catálogo',
    `- Cartas leídas de la API: ${stats.raw}`,
    `- Cartas en el catálogo: ${cards.length} (${sets.length} sets)`,
    `- Descartadas por datos incompletos: ${stats.skipped}`,
    `- Duplicadas ignoradas: ${stats.duplicates}`,
    `- Ids con colisión resuelta: ${stats.collisions}`,
    `- Cartas retiradas conservadas: ${stats.retired}`,
    `- Arte alternativo: ${cards.filter((c) => c.alt).length} | Manga: ${cards.filter((c) => c.manga).length} | SP: ${cards.filter((c) => c.sp).length}`,
    `- Rarezas no reconocidas (se guardan tal cual): ${JSON.stringify(stats.unknownRarities)}`,
    '', '### Por rareza', ...Object.entries(porRareza).map(([r, n]) => `- ${r}: ${n}`),
    '', '### Por set', ...sets.map((s) => `- ${s.id} (${s.kind}) ${s.name}: ${s.card_count}`),
  ];
  return lineas.join('\n');
}

// ------------------------------------------------------------------- red
async function fetchJson(url, intentos = 3) {
  for (let i = 1; i <= intentos; i += 1) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'OnePieceTCGIdle-importer (private fan project)', Accept: 'application/json' },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (i === intentos) throw new Error(`${url}: ${e.message}`);
      await sleep(2000 * i);
    }
  }
  return null;
}

function extractArray(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const lista = Object.values(data).find((v) => Array.isArray(v));
    if (lista) return lista;
  }
  return [];
}

async function upsert(baseUrl, key, tabla, conflicto, filas) {
  for (let i = 0; i < filas.length; i += 500) {
    const r = await fetch(`${baseUrl}/rest/v1/${tabla}?on_conflict=${conflicto}`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(filas.slice(i, i + 500)),
    });
    if (!r.ok) throw new Error(`Supabase ${tabla}: HTTP ${r.status} ${await r.text()}`);
  }
}

// ---------------------------------------------------------------- principal
async function main() {
  let previous = [];
  let previousHash = null;
  try {
    const old = JSON.parse(await readFile(`${OUT_DIR}/cards.json`, 'utf8'));
    previous = old.cards ?? [];
    previousHash = old.content_hash ?? null;
  } catch { /* primera ejecución */ }

  const groups = [];
  for (const ep of ENDPOINTS) {
    const datos = extractArray(await fetchJson(`${API_BASE}${ep.path}`));
    console.log(`${ep.path}: ${datos.length} cartas`);
    groups.push({ group: ep.group, cards: datos });
    await sleep(1500);
  }

  const { cards, sets, stats } = buildCatalog(groups, previous);
  const resumen = summaryText(cards, sets, stats);
  console.log(resumen);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${resumen}\n`);

  if (cards.length === 0) throw new Error('La API no devolvió cartas. Se cancela.');
  if (previous.length > 0 && cards.length < previous.length * 0.8) {
    throw new Error(`Solo ${cards.length} cartas frente a ${previous.length} anteriores. Se cancela por seguridad.`);
  }

  const hash = createHash('sha256').update(JSON.stringify([cards, sets])).digest('hex').slice(0, 16);
  if (hash === previousHash) {
    console.log('Sin cambios en el catálogo.');
  } else {
    const generated_at = new Date().toISOString();
    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(`${OUT_DIR}/cards.json`, JSON.stringify({ generated_at, content_hash: hash, source: SOURCE, count: cards.length, cards }));
    await writeFile(`${OUT_DIR}/sets.json`, JSON.stringify({ generated_at, content_hash: hash, source: SOURCE, count: sets.length, sets }));
    console.log('Archivos cards.json y sets.json actualizados.');
  }

  const url = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SECRET_KEY ?? '';
  if (!url || !key) {
    console.log('AVISO: faltan los secretos SUPABASE_URL / SUPABASE_SECRET_KEY; no se actualiza la base de datos.');
    return;
  }
  const ahora = new Date().toISOString();
  await upsert(url, key, 'catalog_sets', 'set_id', sets.map((s) => ({
    set_id: s.id, name: s.name, kind: s.kind, meta: { card_count: s.card_count }, updated_at: ahora,
  })));
  await upsert(url, key, 'catalog_cards', 'card_id', cards.map((c) => ({
    card_id: c.id, set_id: c.set, code: c.code, name: c.name, rarity: c.rarity, card_type: c.type,
    variant: c.variant,
    meta: { rarity_name: c.rarity_name, alt: c.alt, manga: c.manga, sp: c.sp, labels: c.labels, retired: Boolean(c.retired) },
    updated_at: ahora,
  })));
  console.log(`Base de datos actualizada: ${sets.length} sets y ${cards.length} cartas.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
