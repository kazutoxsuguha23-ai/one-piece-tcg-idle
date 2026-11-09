// Reglas de usuario/contraseña. Deben coincidir con las de la Edge Function "register".

// IMPORTANTE: debe ser IGUAL que EMAIL_DOMAIN en supabase/functions/register/index.ts
export const EMAIL_DOMAIN = 'opidle.app';

const USERNAME_REGEX = /^[A-Za-z0-9_]{3,20}$/;

export function validateUsername(usuario) {
  if (!USERNAME_REGEX.test((usuario || '').trim())) {
    return 'El usuario debe tener 3-20 caracteres: letras, números o _';
  }
  return null;
}

export function validatePassword(clave) {
  if (!clave || clave.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (new TextEncoder().encode(clave).length > 72) return 'La contraseña es demasiado larga';
  if (!/[A-Za-z]/.test(clave) || !/[0-9]/.test(clave)) {
    return 'La contraseña debe incluir letras y números';
  }
  return null;
}

// Supabase Auth necesita un email; lo derivamos del nombre de usuario (nunca se envían emails).
export function toInternalEmail(usuario) {
  return `${usuario.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
}
