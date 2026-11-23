import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatNumber, formatDuration } from '../../src/utils/format.js';

test('formatNumber: números pequeños', () => {
  assert.equal(formatNumber(0), '0');
  assert.equal(formatNumber(5), '5');
  assert.equal(formatNumber(0.2), '0.2');
  assert.equal(formatNumber(1.5), '1.5');
  assert.equal(formatNumber(999), '999');
});

test('formatNumber: sufijos K, M, B, T...', () => {
  assert.equal(formatNumber(1000), '1K');
  assert.equal(formatNumber(1234), '1.23K');
  assert.equal(formatNumber(2.5e9), '2.5B');
  assert.equal(formatNumber(1.2e15), '1.2Qa');
});

test('formatNumber: el redondeo no deja "1000K"', () => {
  assert.equal(formatNumber(999999), '1M');
  assert.equal(formatNumber(999999.9), '1M');
});

test('formatNumber: cifras enormes, negativos y valores no válidos', () => {
  assert.equal(formatNumber(3e33), '3Dc');
  assert.equal(formatNumber('123456789012345678901234'), '123.46Sx');
  assert.equal(formatNumber(-1500), '-1.5K');
  assert.equal(formatNumber(NaN), '0');
  assert.equal(formatNumber('x'), '0');
  assert.equal(formatNumber(5e40), '5.00e40');
});

test('formatDuration', () => {
  assert.equal(formatDuration(28800), '8 h 0 min');
  assert.equal(formatDuration(90), '1 min');
  assert.equal(formatDuration(0), '0 min');
  assert.equal(formatDuration(-5), '0 min');
});
