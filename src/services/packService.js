import { supabase } from './supabaseClient.js';
import { traducirError } from './gameService.js';

export async function fetchProducts() {
  const { data, error } = await supabase
    .from('pack_products')
    .select('product_id, name, kind, set_id, price, config, sort_order')
    .eq('enabled', true)
    .order('sort_order')
    .limit(1000);
  if (error) throw new Error(traducirError(error));
  return data.map((p) => ({ ...p, price: Number(p.price) }));
}

// Sobres sin abrir del jugador (el filtro por user_id es imprescindible: los admins pueden leer los de todos).
export async function fetchMyPacks(idJugador) {
  const { data, error } = await supabase
    .from('player_packs')
    .select('product_id, quantity')
    .eq('user_id', idJugador)
    .gt('quantity', 0);
  if (error) throw new Error(traducirError(error));
  return data;
}

async function llamar(nombre, argumentos) {
  const { data, error } = await supabase.rpc(nombre, argumentos);
  if (error) throw new Error(traducirError(error));
  return data;
}

export const buyPack = (productId, cantidad, requestId) =>
  llamar('buy_pack', { p_product_id: productId, p_quantity: cantidad, p_request_id: requestId });
export const openPack = (productId, requestId) =>
  llamar('open_pack', { p_product_id: productId, p_request_id: requestId });
