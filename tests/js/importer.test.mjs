import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalog, normalizeCard, normalizeSetId, setKind } from '../../scripts/import-catalog.mjs';

const c = (o) => ({
  card_name: 'X', card_set_id: 'OP01-001', card_image_id: 'OP01-001', set_id: 'OP-01', set_name: 'Romance Dawn',
  rarity: 'Leader', card_type: 'Leader', card_cost: '5', card_power: '5000', ...o,
});

test('ids de set y tipos', () => {
  assert.equal(normalizeSetId('OP-01'), 'OP01');
  assert.equal(normalizeSetId('op14-eb04'), 'OP14EB04');
  const tipos = { OP01: 'booster', OP15EB04: 'booster', EB02: 'extra_booster', PRB01: 'premium_booster', ST13: 'starter_deck', PROMO: 'promo', DON: 'don', ZZ: 'other' };
  for (const [id, tipo] of Object.entries(tipos)) assert.equal(setKind(id), tipo, id);
});

test('variantes: arte alternativo, Manga y SP se detectan por el nombre y el id de imagen', () => {
  const r = normalizeCard(c({ card_name: 'Tony Tony.Chopper (Alternate Art) (Manga)', card_set_id: 'EB01-006', card_image_id: 'EB01-006_p2', set_id: 'EB-01', rarity: 'SEC' }), 'set');
  assert.equal(r.card.name, 'Tony Tony.Chopper');
  assert.equal(r.card.variant, 'p2');
  assert.ok(r.card.alt && r.card.manga && !r.card.sp);
  assert.equal(r.card.rarity, 'SEC');
  const reimpresion = normalizeCard(c({ card_image_id: 'OP01-001_r1' }), 'set');
  assert.equal(reimpresion.card.variant, 'r1');
  assert.equal(reimpresion.card.alt, false, 'una reimpresión (_rN) NO es arte alternativo');
});

test('los números entre paréntesis del nombre se conservan', () => {
  assert.equal(normalizeCard(c({ card_name: 'Blueno (017)' }), 'set').card.name, 'Blueno (017)');
});

test('datos incompletos se descartan; promos y DON van a su set', () => {
  assert.equal(normalizeCard(c({ card_name: '', card_image_id: '' }), 'set'), null);
  assert.equal(normalizeCard(c({ card_name: 'P', card_image_id: 'P-001', set_id: '' }), 'promo').card.set, 'PROMO');
  const don = normalizeCard({ card_name: 'DON!! Card', card_image_id: 'don_1', card_type: 'DON!!' }, 'don');
  assert.equal(don.card.set, 'DON');
  assert.equal(don.card.rarity, 'DON');
  assert.equal(don.card.type, 'don');
});

test('abreviaturas de rareza reconocidas; las desconocidas se guardan tal cual', () => {
  for (const r of ['C', 'UC', 'R', 'SR', 'SEC', 'L', 'TR', 'P', 'PR']) {
    assert.equal(normalizeCard(c({ rarity: r }), 'set').card.rarity, r);
    assert.equal(normalizeCard(c({ rarity: r }), 'set').rarityKnown, true, r);
  }
  const rara = normalizeCard(c({ rarity: 'Rareza Nueva' }), 'set');
  assert.equal(rara.card.rarity, 'Rareza Nueva');
  assert.equal(rara.rarityKnown, false);
});

const grupos = [
  { group: 'set', cards: [
    c({}), c({ card_name: 'Dup', card_image_id: 'OP01-001' }),
    c({ card_name: 'Zoro Alt', card_image_id: 'OP01-001_p1', rarity: 'SR' }),
    c({ card_name: 'Nami', card_set_id: 'OP02-001', card_image_id: 'OP02-001', set_id: 'OP-02' }),
  ] },
  { group: 'starter', cards: [c({ card_name: 'Reimpresión', card_image_id: 'OP01-001', set_id: 'ST-02', set_name: 'Worst Generation' })] },
];

test('duplicados ignorados y colisiones de id entre sets resueltas', () => {
  const { cards, stats } = buildCatalog(grupos, []);
  assert.equal(stats.duplicates, 1);
  assert.equal(stats.collisions, 1);
  assert.equal(new Set(cards.map((x) => x.id)).size, cards.length, 'ids únicos');
  assert.ok(cards.some((x) => x.id === 'OP01-001@ST02'));
});

test('los ids son ESTABLES entre importaciones y las cartas que desaparecen se conservan como retiradas', () => {
  const primera = buildCatalog(grupos, []).cards;
  const sinNami = grupos.map((g) => ({ ...g, cards: g.cards.filter((x) => x.card_name !== 'Nami') }));
  const segunda = buildCatalog(sinNami, primera);
  for (const antigua of primera) {
    const nueva = segunda.cards.find((x) => x.id === antigua.id);
    assert.ok(nueva, `se perdió el id ${antigua.id}`);
  }
  assert.equal(segunda.stats.retired, 1);
  assert.equal(segunda.cards.find((x) => x.id === 'OP02-001').retired, true);
});

test('el nombre de un set es el que más cartas repiten', () => {
  const mk = (i, nombre) => c({ card_set_id: `ST02-00${i}`, card_image_id: `ST02-00${i}`, set_id: 'ST-02', set_name: nombre });
  const { sets } = buildCatalog([{ group: 'starter', cards: [mk(1, 'Nombre de otro set'), mk(2, 'Worst Generation'), mk(3, 'Worst Generation')] }], []);
  assert.equal(sets[0].name, 'Worst Generation');
});
