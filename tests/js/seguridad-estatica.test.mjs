import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Revisiones de seguridad que se hacen leyendo los archivos (no necesitan base de datos).
const dirSql = 'supabase/migrations';
const migraciones = readdirSync(dirSql).filter((f) => f.endsWith('.sql')).sort()
  .map((f) => ({ f, s: readFileSync(join(dirSql, f), 'utf8') }));
const todoSql = migraciones.map((m) => m.s).join('\n');

function archivos(dir, salida = []) {
  if (!existsSync(dir)) return salida; // p. ej. 'public' puede no existir todavía
  for (const nombre of readdirSync(dir)) {
    if (['node_modules', '.git', 'dist'].includes(nombre)) continue;
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) archivos(ruta, salida);
    else salida.push(ruta);
  }
  return salida;
}

test('toda función SECURITY DEFINER fija search_path (evita secuestro de funciones)', () => {
  for (const m of todoSql.matchAll(/create or replace function public\.(\w+)\(([\s\S]*?)\n\$\$;/g)) {
    const cabecera = m[0].split(/\nas \$\$/)[0];
    if (/security definer/i.test(cabecera)) {
      assert.match(cabecera, /set search_path\s*=\s*''/, `public.${m[1]} es SECURITY DEFINER sin search_path`);
    }
  }
});

test('toda tabla de public tiene RLS activado', () => {
  const tablas = [...todoSql.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1]);
  assert.ok(tablas.length >= 12, 'no se encontraron las tablas esperadas');
  for (const t of tablas) {
    assert.match(todoSql, new RegExp(`alter table public\\.${t}\\s+enable row level security`), `public.${t} sin RLS`);
  }
});

test('no hay políticas de escritura: el navegador solo puede LEER', () => {
  assert.doesNotMatch(todoSql, /create policy \w+ on [\w.]+\s+for\s+(insert|update|delete|all)/i);
});

test('no se conceden permisos de escritura a anon ni a authenticated', () => {
  assert.doesNotMatch(todoSql, /grant\s+(insert|update|delete|truncate|all)\b[^;]*\bto\b[^;]*\b(anon|authenticated)\b/i);
});

test('las funciones de jugador de la última migración llevan límite de frecuencia', () => {
  const m5 = migraciones.find((m) => m.f.startsWith('0005'));
  assert.ok(m5, 'falta la migración 0005');
  for (const f of ['collect_all', 'collect_card', 'buy_pack', 'open_pack', 'card_upgrade_info', 'upgrade_card',
    'sell_card_duplicates', 'sell_duplicates_bulk', 'buy_upgrade']) {
    assert.match(m5.s, new RegExp(`create or replace function public\\.${f}\\(`), f);
    assert.match(m5.s, new RegExp(`enforce_rate_limit\\('${f}'`), `${f} sin límite`);
  }
});

test('todos los errores del servidor tienen mensaje en español para el jugador', () => {
  const mensajes = readFileSync('src/services/gameService.js', 'utf8');
  const codigos = new Set([...todoSql.matchAll(/raise exception '(\w+)'/g)].map((m) => m[1]));
  codigos.delete('invalid_username'); // lo gestiona la función de registro
  for (const c of codigos) assert.match(mensajes, new RegExp(`\\b${c}\\b`), `error «${c}» sin traducir`);
});

test('el registro no se fía de la primera IP de x-forwarded-for (falsificable)', () => {
  const fn = readFileSync('supabase/functions/register/index.ts', 'utf8');
  assert.doesNotMatch(fn, /split\(','\)\[0\]/);
  assert.match(fn, /cf-connecting-ip/);
  assert.match(fn, /register:global/);
});

test('no hay claves secretas en el código que va al navegador', () => {
  const sospechosos = [];
  for (const ruta of [...archivos('src'), ...archivos('public'), 'index.html']) {
    if (!existsSync(ruta)) continue;
    if (!/\.(js|jsx|mjs|html|json|css)$/.test(ruta)) continue;
    const t = readFileSync(ruta, 'utf8');
    if (/sb_secret_[A-Za-z0-9_-]{8,}/.test(t)) sospechosos.push(`${ruta}: clave sb_secret_`);
    for (const m of t.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.([A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{5,}/g)) {
      try {
        const carga = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8'));
        if (carga.role === 'service_role') sospechosos.push(`${ruta}: JWT con role service_role`);
      } catch { /* no es un JWT */ }
    }
  }
  assert.deepEqual(sospechosos, [], 'HAY CLAVES SECRETAS EN EL CÓDIGO PÚBLICO');
});

test('el código no usa HTML sin escapar ni eval (riesgo XSS)', () => {
  for (const ruta of archivos('src')) {
    if (!/\.(js|jsx)$/.test(ruta)) continue;
    const t = readFileSync(ruta, 'utf8');
    assert.doesNotMatch(t, /dangerouslySetInnerHTML|\.innerHTML\s*=|\beval\(|new Function\(/, ruta);
  }
});

test('index.html lleva Content-Security-Policy sin unsafe-eval', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /script-src 'self'/);
  assert.doesNotMatch(html, /unsafe-eval/);
  assert.match(html, /object-src 'none'/);
});
