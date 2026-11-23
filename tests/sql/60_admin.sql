-- ADMINISTRACIÓN
do $$
declare
  v_admin uuid := t.login('admin1');
  v_alice uuid;
  v_erin uuid;
  v_n integer;
  v_antes numeric;
  r jsonb;
begin
  select id into v_alice from public.profiles where username_lower = 'alice';
  select id into v_erin from public.profiles where username_lower = 'erin';

  select count(*) into v_n from public.admin_log;
  select coins into v_antes from public.player_economy where user_id = v_alice;
  perform public.admin_give_coins('alice', 1000);
  perform t.ok((select coins from public.player_economy where user_id = v_alice) = v_antes + 1000, 'el admin puede dar monedas');
  perform t.ok((select count(*) from public.admin_log) = v_n + 1, 'y la acción queda en el registro de administración');
  perform t.ok((select action from public.admin_log order by id desc limit 1) = 'give_coins', 'con el tipo de acción correcto');

  perform t.fails($q$select public.admin_give_coins('alice', 0)$q$, 'invalid_amount', 'cantidad cero: error');
  perform t.fails($q$select public.admin_give_coins('alice', 1.5)$q$, 'invalid_amount', 'no admite decimales');
  perform t.fails($q$select public.admin_give_coins('alice', 1e25)$q$, 'invalid_amount', 'hay un tope de cantidad');
  perform t.fails($q$select public.admin_give_coins('nadie', 10)$q$, 'user_not_found', 'jugador inexistente: error');
  perform t.fails($q$select public.admin_set_coins('alice', -1)$q$, 'invalid_amount', 'fijar un saldo negativo: error');
  perform public.admin_give_coins('alice', -999999999999999);
  perform t.ok((select coins from public.player_economy where user_id = v_alice) = 0, 'quitar más de lo que hay deja el saldo en 0, nunca negativo');
  perform public.admin_set_coins('alice', 777);
  perform t.ok((select coins from public.player_economy where user_id = v_alice) = 777, 'fijar el saldo funciona');

  perform t.fails($q$select public.admin_give_pack('alice', 'NOEXISTE', 1)$q$, 'product_not_found', 'dar un sobre inexistente: error');
  perform t.fails($q$select public.admin_give_pack('alice', 'OP01', 1001)$q$, 'invalid_quantity', 'dar demasiados sobres: error');
  perform t.fails($q$select public.admin_give_card('alice', 'OP01-C001', 0)$q$, 'invalid_quantity', 'dar 0 copias: error');
  perform t.fails($q$select public.admin_give_card('alice', 'NO-EXISTE', 1)$q$, 'card_not_found', 'dar una carta inexistente: error');
  perform t.fails($q$select public.admin_set_card_level('alice', 'OP01-C001', 101)$q$, 'invalid_level', 'nivel fuera de 1-100: error');
  perform t.fails($q$select public.admin_set_card_level('erin', 'OP01-U030', 5)$q$, 'card_not_owned', 'cambiar el nivel de una carta que no tiene: error');

  select count(*) into v_n from public.admin_list_users('al');
  perform t.ok(v_n = 1, 'la búsqueda de jugadores encuentra a alice');
  perform t.ok(public.admin_recalc_all() = (select count(*) from public.profiles), 'recalcular la producción pasa por todos los jugadores');
  perform t.ok(public.admin_sync_products() = 0, 'sincronizar productos no duplica los existentes');

  -- reiniciar un jugador
  perform public.admin_reset_user('erin');
  perform t.ok(not exists (select 1 from public.player_cards where user_id = v_erin), 'reiniciar borra sus cartas');
  perform t.ok((select coins from public.player_economy where user_id = v_erin) = 500, 'y devuelve el saldo inicial');
  perform t.ok((select upgrades from public.player_progress where user_id = v_erin) = '{}'::jsonb, 'y borra sus mejoras');
  perform t.ok((select production_per_sec from public.player_economy where user_id = v_erin) = 0, 'y su producción vuelve a 0');
  perform t.ok((select role from public.profiles where id = v_erin) = 'player', 'sin tocar su rol ni su nombre');
end;
$$;
