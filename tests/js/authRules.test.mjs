import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateUsername, validatePassword, toInternalEmail, EMAIL_DOMAIN } from '../../src/utils/authRules.js';

test('usuario válido e inválido', () => {
  assert.equal(validateUsername('abc'), null);
  assert.equal(validateUsername('Alice_01'), null);
  assert.equal(validateUsername('a'.repeat(20)), null);
  for (const malo of ['', 'ab', 'a'.repeat(21), 'con espacio', 'ñandú', 'a-b', 'a.b', '<script>', "o'neil"]) {
    assert.notEqual(validateUsername(malo), null, `debería rechazar «${malo}»`);
  }
});

test('contraseña: longitud, letras y números', () => {
  assert.equal(validatePassword('abcd1234'), null);
  assert.notEqual(validatePassword('abc123'), null, 'menos de 8 caracteres');
  assert.notEqual(validatePassword('abcdefgh'), null, 'sin números');
  assert.notEqual(validatePassword('12345678'), null, 'sin letras');
  assert.notEqual(validatePassword('a1'.repeat(40)), null, 'más de 72 bytes');
  assert.notEqual(validatePassword(''), null);
});

test('el email interno no distingue mayúsculas ni espacios', () => {
  assert.equal(toInternalEmail('Alice '), `alice@${EMAIL_DOMAIN}`);
  assert.equal(toInternalEmail('ALICE'), toInternalEmail('alice'));
});

test('el dominio del email coincide con el de la función de registro', async () => {
  const { readFileSync } = await import('node:fs');
  const fn = readFileSync('supabase/functions/register/index.ts', 'utf8');
  assert.match(fn, new RegExp(`EMAIL_DOMAIN = '${EMAIL_DOMAIN}'`));
});
