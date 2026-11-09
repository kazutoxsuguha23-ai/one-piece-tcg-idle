// Edge Function "register": crea cuentas con usuario + contraseña.
// Crea un usuario en Supabase Auth con un email interno (nunca se envían emails).
import { createClient } from 'npm:@supabase/supabase-js@2';

// IMPORTANTE: debe ser IGUAL que EMAIL_DOMAIN en src/utils/authRules.js
const EMAIL_DOMAIN = 'opidle.app';
const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const MAX_REGISTROS_POR_HORA_Y_IP = 10;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function validarClave(clave: string): string | null {
  if (clave.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (new TextEncoder().encode(clave).length > 72) return 'La contraseña es demasiado larga';
  if (!/[A-Za-z]/.test(clave) || !/[0-9]/.test(clave)) {
    return 'La contraseña debe incluir letras y números';
  }
  return null;
}

async function sha256Hex(texto: string): Promise<string> {
  const datos = new TextEncoder().encode(texto);
  const hash = await crypto.subtle.digest('SHA-256', datos);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const clave = Deno.env.get('OPI_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !clave) return json({ error: 'Servidor mal configurado' }, 500);
  const admin = createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await req.json();
  } catch {
    return json({ error: 'Petición no válida' }, 400);
  }
  const username = String(cuerpo?.username ?? '').trim();
  const password = String(cuerpo?.password ?? '');
  const inviteCode = String(cuerpo?.inviteCode ?? '').trim();

  // 1) Límite de frecuencia por IP (la IP se guarda solo como hash)
  const ip = (req.headers.get('x-forwarded-for') ?? 'desconocida').split(',')[0].trim();
  const { data: permitido, error: errLimite } = await admin.rpc('consume_rate_limit', {
    p_key: `register:${await sha256Hex(ip)}`,
    p_max: MAX_REGISTROS_POR_HORA_Y_IP,
    p_window_seconds: 3600,
  });
  if (errLimite) {
    console.error('rate limit', errLimite.message);
    return json({ error: 'Error interno' }, 500);
  }
  if (!permitido) return json({ error: 'Demasiados intentos. Inténtalo más tarde.' }, 429);

  // 2) Validaciones
  if (!USERNAME_RE.test(username)) {
    return json({ error: 'El usuario debe tener 3-20 caracteres: letras, números o _' }, 400);
  }
  const errClave = validarClave(password);
  if (errClave) return json({ error: errClave }, 400);

  // 3) ¿Está abierto el registro? ¿Hace falta código de invitación?
  const { data: filas, error: errCfg } = await admin
    .from('game_config').select('key, value').in('key', ['registration_open', 'invite_code']);
  if (errCfg) {
    console.error('config', errCfg.message);
    return json({ error: 'Error interno' }, 500);
  }
  const cfg = Object.fromEntries((filas ?? []).map((f) => [f.key, f.value]));
  if (cfg.registration_open !== true) return json({ error: 'El registro está cerrado' }, 403);
  if (typeof cfg.invite_code === 'string' && cfg.invite_code !== '' && cfg.invite_code !== inviteCode) {
    return json({ error: 'Código de invitación incorrecto' }, 403);
  }

  // 4) Nombre ya usado
  const { data: existe } = await admin
    .from('profiles').select('id').eq('username_lower', username.toLowerCase()).maybeSingle();
  if (existe) return json({ error: 'Ese nombre de usuario ya existe' }, 409);

  // 5) Crear la cuenta (un trigger de la base de datos crea perfil, economía y progreso)
  const { error: errCrear } = await admin.auth.admin.createUser({
    email: `${username.toLowerCase()}@${EMAIL_DOMAIN}`,
    password,
    email_confirm: true,
    user_metadata: { username },
  });
  if (errCrear) {
    console.error('createUser', errCrear.message, errCrear.code);
    return json({ error: 'No se pudo crear la cuenta', code: errCrear.code ?? null }, 409);
  }
  return json({ ok: true }, 201);
});
