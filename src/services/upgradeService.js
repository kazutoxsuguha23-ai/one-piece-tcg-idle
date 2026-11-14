import { supabase } from './supabaseClient.js';
import { traducirError } from './gameService.js';

async function llamar(nombre, argumentos) {
  const { data, error } = await supabase.rpc(nombre, argumentos);
  if (error) throw new Error(traducirError(error));
  return data;
}

// Todo se calcula y se valida en el servidor. Los parámetros "desde nivel" / "copias esperadas" /
// "monedas esperadas" hacen que un doble clic o un reintento no se pueda cobrar dos veces.
export const cardUpgradeInfo = (cardId) => llamar('card_upgrade_info', { p_card_id: cardId });
export const upgradeCard = (cardId, desdeNivel, niveles) =>
  llamar('upgrade_card', { p_card_id: cardId, p_from_level: desdeNivel, p_levels: niveles });
export const sellCardDuplicates = (cardId, cantidad, copiasEsperadas) =>
  llamar('sell_card_duplicates', { p_card_id: cardId, p_quantity: cantidad, p_expected_copies: copiasEsperadas });
export const sellDuplicatesBulk = (rarezas, conVariantes, confirmar, monedasEsperadas) =>
  llamar('sell_duplicates_bulk', {
    p_rarities: rarezas,
    p_include_variants: conVariantes,
    p_confirm: confirmar,
    p_expected_coins: monedasEsperadas,
  });
export const listUpgrades = () => llamar('list_upgrades');
export const buyUpgrade = (id, nivelEsperado) => llamar('buy_upgrade', { p_upgrade_id: id, p_expected_level: nivelEsperado });
