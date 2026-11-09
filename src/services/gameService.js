import { supabase } from './supabaseClient.js';

const MENSAJES = {
  forbidden: 'No tienes permisos de administrador',
  user_not_found: 'Ese usuario no existe',
  invalid_amount: 'Cantidad no válida (usa un número entero)',
  invalid_quantity: 'Cantidad de sobres no válida (1-1000)',
  product_not_found: 'Ese producto no existe',
  not_authenticated: 'Sesión no válida, vuelve a entrar',
  profile_missing: 'Tu perfil no existe en la base de datos',
};

export function traducirError(error) {
  const texto = error?.message ?? '';
  const clave = Object.keys(MENSAJES).find((k) => texto.includes(k));
  return clave ? MENSAJES[clave] : `Error inesperado: ${texto}`;
}

async function llamar(nombre, argumentos) {
  const { data, error } = await supabase.rpc(nombre, argumentos);
  if (error) throw new Error(traducirError(error));
  return data;
}

export const bootstrapSession = () => llamar('bootstrap_session');

export async function listProducts() {
  const { data, error } = await supabase
    .from('pack_products')
    .select('product_id, name, kind')
    .order('sort_order');
  if (error) throw new Error(traducirError(error));
  return data;
}

// ---- Admin (el servidor vuelve a comprobar que eres admin en cada llamada) ----
export const adminListUsers = (texto) => llamar('admin_list_users', { p_search: texto || '' });
export const adminGiveCoins = (usuario, cantidad) =>
  llamar('admin_give_coins', { p_username: usuario, p_amount: cantidad });
export const adminSetCoins = (usuario, cantidad) =>
  llamar('admin_set_coins', { p_username: usuario, p_amount: cantidad });
export const adminGivePack = (usuario, producto, cantidad) =>
  llamar('admin_give_pack', { p_username: usuario, p_product_id: producto, p_quantity: cantidad });
export const adminResetUser = (usuario) => llamar('admin_reset_user', { p_username: usuario });
