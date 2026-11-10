import { supabase } from './supabaseClient.js';
import { traducirError } from './gameService.js';

// Todas las cartas del jugador (el filtro por user_id es imprescindible: los admins pueden leer las de todos). Se pide por páginas porque Supabase devuelve 1000 filas como máximo.
export async function fetchMyCards(idJugador) {
  const pagina = 1000;
  const todas = [];
  for (let desde = 0; ; desde += pagina) {
    const { data, error } = await supabase
      .from('player_cards')
      .select('card_id, copies, level, production_per_sec, last_collected_at')
      .eq('user_id', idJugador)
      .order('card_id')
      .range(desde, desde + pagina - 1);
    if (error) throw new Error(traducirError(error));
    todas.push(...data);
    if (data.length < pagina) break;
  }
  return todas;
}

async function llamar(nombre, argumentos) {
  const { data, error } = await supabase.rpc(nombre, argumentos);
  if (error) throw new Error(traducirError(error));
  return data;
}

export const collectAll = () => llamar('collect_all');
export const collectCard = (idCarta) => llamar('collect_card', { p_card_id: idCarta });
