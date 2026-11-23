import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dividirEnPaginas, totalSpreads, indicesDeSpread, spreadDePagina, rotuloPaginas, filtrarYOrdenar,
} from '../../src/components/album/albumUtils.js';

test('dividir en páginas de 9', () => {
  const p = dividirEnPaginas(Array.from({ length: 20 }, (_, i) => i));
  assert.deepEqual(p.map((x) => x.length), [9, 9, 2]);
  assert.equal(dividirEnPaginas([]).length, 0);
});

test('libro: cada página aparece en exactamente una vista (hasta 120 páginas)', () => {
  for (const n of [1, 2, 3, 4, 5, 8, 9, 120]) {
    const vistas = totalSpreads(n, false);
    const vista = new Map();
    for (let s = 0; s < vistas; s += 1) {
      const { izq, der } = indicesDeSpread(s, false);
      for (const idx of [izq, der]) {
        if (idx >= 0 && idx < n) {
          assert.ok(!vista.has(idx), `n=${n}: página ${idx} repetida`);
          vista.set(idx, s);
        }
      }
    }
    assert.equal(vista.size, n, `n=${n}: faltan páginas`);
    for (let idx = 0; idx < n; idx += 1) assert.equal(spreadDePagina(idx, false), vista.get(idx));
  }
});

test('rótulos de página', () => {
  assert.equal(rotuloPaginas(0, 10, false), 'Página 1 de 10');
  assert.equal(rotuloPaginas(1, 10, false), 'Páginas 2–3 de 10');
  assert.equal(rotuloPaginas(0, 0, false), 'Sin cartas');
  assert.equal(rotuloPaginas(3, 7, true), 'Página 4 de 7');
});

const info = (id, name, rarity, extra = {}) => ({ id, code: id.split('_')[0], name, rarity, alt: false, manga: false, sp: false, ...extra });
const cartas = [
  info('OP01-001', 'Zoro', 'L'), info('OP01-002', 'Nami', 'C'), info('OP01-003', 'Luffy', 'SR'),
  info('OP01-003_p1', 'Luffy', 'SR', { alt: true }), info('OP01-004', 'Chopper', 'SEC', { manga: true, alt: true }),
  info('OP01-005', 'Usopp', 'R', { sp: true }),
];
const pos = new Map([
  ['OP01-002', { level: 5, copies: 3, production_per_sec: '2.5' }],
  ['OP01-003_p1', { level: 20, copies: 1, production_per_sec: '90' }],
  ['OP01-004', { level: 1, copies: 2, production_per_sec: '500' }],
]);
const ids = (r) => r.map((x) => x.info.id).join();

test('filtros por estado, rareza y variante', () => {
  assert.equal(ids(filtrarYOrdenar(cartas, pos, { estado: 'descubiertas' })), 'OP01-002,OP01-003_p1,OP01-004');
  assert.equal(filtrarYOrdenar(cartas, pos, { estado: 'desconocidas' }).length, 3);
  assert.equal(ids(filtrarYOrdenar(cartas, pos, { rareza: 'v:manga' })), 'OP01-004');
  assert.equal(ids(filtrarYOrdenar(cartas, pos, { rareza: 'v:alt' })), 'OP01-003_p1', 'alt excluye manga');
  assert.equal(ids(filtrarYOrdenar(cartas, pos, { rareza: 'v:sp' })), 'OP01-005');
  assert.equal(ids(filtrarYOrdenar(cartas, pos, { rareza: 'r:SR' })), 'OP01-003,OP01-003_p1');
});

test('orden por producción, nivel, copias, rareza y nombre', () => {
  assert.ok(ids(filtrarYOrdenar(cartas, pos, { orden: 'produccion' })).startsWith('OP01-004,OP01-003_p1,OP01-002'));
  assert.ok(ids(filtrarYOrdenar(cartas, pos, { orden: 'nivel' })).startsWith('OP01-003_p1,OP01-002,OP01-004'));
  assert.ok(ids(filtrarYOrdenar(cartas, pos, { orden: 'copias' })).startsWith('OP01-002,OP01-004,OP01-003_p1'));
  assert.equal(filtrarYOrdenar(cartas, pos, { orden: 'rareza' })[0].info.id, 'OP01-004');
  assert.equal(ids(filtrarYOrdenar(cartas, pos, { orden: 'nombre', estado: 'descubiertas' })), 'OP01-004,OP01-003_p1,OP01-002');
});

test('la búsqueda NO revela el nombre de cartas sin descubrir', () => {
  assert.equal(ids(filtrarYOrdenar(cartas, pos, { texto: 'nami' })), 'OP01-002');
  assert.equal(ids(filtrarYOrdenar(cartas, pos, { texto: 'zoro' })), '', 'Zoro no está descubierta');
  assert.equal(ids(filtrarYOrdenar(cartas, pos, { texto: 'op01-001' })), 'OP01-001', 'por código sí');
});
