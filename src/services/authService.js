import { supabase } from './supabaseClient.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';
import { toInternalEmail } from '../utils/authRules.js';

// Registro: pasa por la Edge Function (valida, limita abusos y crea la cuenta).
export async function registerAccount({ username, password, inviteCode }) {
  let respuesta;
  try {
    respuesta = await fetch(`${SUPABASE_URL}/functions/v1/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ username, password, inviteCode }),
    });
  } catch {
    throw new Error('No se pudo contactar con el servidor');
  }
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const detalle = datos.code ? ` (${datos.code})` : '';
    throw new Error((datos.error || `Error ${respuesta.status}`) + detalle);
  }
  return datos;
}

// Mensaje genérico a propósito: no revela si el usuario existe.
export async function login(usuario, clave) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: toInternalEmail(usuario),
    password: clave,
  });
  if (error) throw new Error('Usuario o contraseña incorrectos');
  return data.session;
}

export async function logout() {
  await supabase.auth.signOut();
}

// Avisa en cuanto hay sesión (incluida la recuperada al recargar la página).
export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => callback(sesion));
  return () => data.subscription.unsubscribe();
}

// Configuración pública del juego (p. ej. si el registro está abierto).
export async function fetchPublicConfig() {
  const { data, error } = await supabase.from('game_config').select('key, value');
  if (error) throw error;
  return Object.fromEntries(data.map((fila) => [fila.key, fila.value]));
}
