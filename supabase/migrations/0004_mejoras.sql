-- ============================================================================
-- One Piece TCG Idle - FASE 9: mejoras de cartas, venta de repetidas y mejoras globales
-- Se puede ejecutar varias veces. NO pisa los valores que cambies en game_config.
-- Todo es atómico (una sola transacción por operación) y se valida en el servidor.
-- ============================================================================

-- ===================== 1. CONFIGURACIÓN POR DEFECTO ==========================
-- Editable en Supabase > Table Editor > game_config > clave "upgrades".
--  card_level: copias repetidas y monedas que cuesta cada nivel (1 -> 100)
--  sell: segundos de producción (nivel 1) que paga cada copia repetida vendida
--  global: mejoras para toda la cuenta
insert into public.game_config (key, value, is_public, description) values
  ('upgrades', $json$
  {
    "card_level": {
      "max_level": 100,
      "copies_tiers": [
        {"upto": 9,  "copies": 1},
        {"upto": 24, "copies": 2},
        {"upto": 49, "copies": 3},
        {"upto": 74, "copies": 5},
        {"upto": 99, "copies": 8}
      ],
      "copies_mult_by_rarity": {"C":1,"UC":1,"R":1,"L":1,"SR":0.5,"SEC":0.25,"TR":0.25,"PR":1,"P":1,"DON":1},
      "copies_mult_variant": {"alt":0.5,"sp":0.5,"manga":0.25},
      "coin_seconds_base": 600,
      "coin_growth": 1.07
    },
    "sell": {"seconds": 300},
    "global": [
      {"id":"prod_mult","name":"Maestría del tesoro","description":"+10% de producción en todas tus cartas por nivel","type":"prod_mult","per_level":0.1,"max_level":50,"base_cost":5000,"growth":1.35},
      {"id":"storage","name":"Almacén ampliado","description":"+1 hora de capacidad de almacenamiento por nivel","type":"storage_seconds","per_level":3600,"max_level":24,"base_cost":3000,"growth":1.3}
    ]
  }
  $json$::jsonb, true,
  'Mejoras: coste de subir de nivel (copias + monedas), precio de venta de repetidas y mejoras globales')
on conflict (key) do nothing;

-- ===================== 2. COSTE DE SUBIR UN NIVEL ============================
-- Coste de pasar de p_level a p_level + 1: copias repetidas de ESA carta exacta + monedas.
-- Las copias dependen del tramo de nivel y se reducen en cartas raras / variantes.
-- Las monedas escalan con lo que produce la propia carta (nivel 1) y crecen con el nivel.
create or replace function public.card_upgrade_cost(p_card_id text, p_level integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cfg    jsonb := coalesce(public.cfg('upgrades') -> 'card_level', '{}'::jsonb);
  v_tier   jsonb;
  v_copies numeric;
  v_rarity text;
  v_meta   jsonb;
  v_mult   numeric := 1;
  v_prod1  numeric;
  v_coins  numeric;
begin
  for v_tier in select value from jsonb_array_elements(coalesce(v_cfg -> 'copies_tiers', '[]'::jsonb)) loop
    if p_level <= (v_tier ->> 'upto')::integer then
      v_copies := (v_tier ->> 'copies')::numeric;
      exit;
    end if;
  end loop;
  if v_copies is null then
    v_copies := coalesce((v_cfg -> 'copies_tiers' -> -1 ->> 'copies')::numeric, 1);
  end if;

  select c.rarity, c.meta into v_rarity, v_meta from public.catalog_cards c where c.card_id = p_card_id;
  v_mult := coalesce((v_cfg #>> array['copies_mult_by_rarity', v_rarity])::numeric, 1);
  if coalesce((v_meta ->> 'manga')::boolean, false) then
    v_mult := v_mult * coalesce((v_cfg #>> '{copies_mult_variant,manga}')::numeric, 1);
  elsif coalesce((v_meta ->> 'sp')::boolean, false) then
    v_mult := v_mult * coalesce((v_cfg #>> '{copies_mult_variant,sp}')::numeric, 1);
  elsif coalesce((v_meta ->> 'alt')::boolean, false) then
    v_mult := v_mult * coalesce((v_cfg #>> '{copies_mult_variant,alt}')::numeric, 1);
  end if;
  v_copies := greatest(1, ceil(v_copies * v_mult));

  v_prod1 := public.calc_card_production(p_card_id, 1, 1);
  v_coins := ceil(greatest(v_prod1, 0.0001)
                  * coalesce((v_cfg ->> 'coin_seconds_base')::numeric, 600)
                  * power(coalesce((v_cfg ->> 'coin_growth')::numeric, 1.07), greatest(p_level - 1, 0)));

  return jsonb_build_object('copies', v_copies, 'coins', v_coins);
end;
$$;

-- ===================== 3. INFORMACIÓN PARA LA PANTALLA ========================
-- Todo lo que el navegador muestra sobre mejorar / vender sale de aquí (nada se calcula en el cliente).
create or replace function public.card_upgrade_info(p_card_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := auth.uid();
  v_card        record;
  v_cfg         jsonb := coalesce(public.cfg('upgrades'), '{}'::jsonb);
  v_max         integer;
  v_mult        numeric;
  v_coins       numeric;
  v_level       integer;
  v_copies_left integer;
  v_coins_left  numeric;
  v_cost        jsonb;
  v_levels      integer := 0;
  v_tot_copies  integer := 0;
  v_tot_coins   numeric := 0;
  v_plan        jsonb := '[]'::jsonb;
  v_sell        numeric;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select copies, level, production_per_sec into v_card
  from public.player_cards where user_id = v_uid and card_id = p_card_id;
  if not found then raise exception 'card_not_owned'; end if;

  v_max := coalesce((v_cfg -> 'card_level' ->> 'max_level')::integer, 100);
  select coalesce((upgrades ->> 'prod_mult')::numeric, 1) into v_mult
  from public.player_progress where user_id = v_uid;
  select coins into v_coins from public.player_economy where user_id = v_uid;

  -- Cuántos niveles seguidos puede subir ahora mismo (la primera copia nunca se gasta)
  v_level := v_card.level;
  v_copies_left := v_card.copies - 1;
  v_coins_left := v_coins;
  while v_level < v_max loop
    v_cost := public.card_upgrade_cost(p_card_id, v_level);
    exit when (v_cost ->> 'copies')::integer > v_copies_left
           or (v_cost ->> 'coins')::numeric > v_coins_left;
    v_copies_left := v_copies_left - (v_cost ->> 'copies')::integer;
    v_coins_left  := v_coins_left - (v_cost ->> 'coins')::numeric;
    v_tot_copies  := v_tot_copies + (v_cost ->> 'copies')::integer;
    v_tot_coins   := v_tot_coins + (v_cost ->> 'coins')::numeric;
    v_levels := v_levels + 1;
    v_level  := v_level + 1;
    v_plan := v_plan || jsonb_build_object('n', v_levels, 'copies', v_tot_copies, 'coins', v_tot_coins::text);
  end loop;

  v_sell := greatest(floor(public.calc_card_production(p_card_id, 1, 1)
                           * coalesce((v_cfg -> 'sell' ->> 'seconds')::numeric, 300)), 1);

  return jsonb_build_object(
    'level', v_card.level,
    'max_level', v_max,
    'copies', v_card.copies,
    'spendable', v_card.copies - 1,
    'next_cost', case when v_card.level < v_max then public.card_upgrade_cost(p_card_id, v_card.level) else null end,
    'max_levels', v_levels,
    'plan', v_plan,
    'production_now', v_card.production_per_sec::text,
    'production_next', case when v_card.level < v_max
                            then public.calc_card_production(p_card_id, v_card.level + 1, v_mult)::text
                            else null end,
    'sell_each', v_sell::text
  );
end;
$$;

-- ===================== 4. SUBIR DE NIVEL ====================================
-- p_from_level evita dobles envíos: si el nivel ya cambió, la operación se rechaza sin cobrar.
create or replace function public.upgrade_card(p_card_id text, p_from_level integer, p_levels integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid          uuid := auth.uid();
  v_card         record;
  v_max          integer;
  v_level        integer;
  v_i            integer;
  v_cost         jsonb;
  v_total_copies integer := 0;
  v_total_coins  numeric := 0;
  v_mult         numeric;
  v_new_prod     numeric;
  v_coins        numeric;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_levels is null or p_levels < 1 or p_levels > 100 then raise exception 'invalid_quantity'; end if;

  perform 1 from public.player_economy where user_id = v_uid for update;

  select copies, level, production_per_sec into v_card
  from public.player_cards where user_id = v_uid and card_id = p_card_id for update;
  if not found then raise exception 'card_not_owned'; end if;
  if v_card.level <> p_from_level then raise exception 'state_changed'; end if;

  v_max := coalesce((public.cfg('upgrades') -> 'card_level' ->> 'max_level')::integer, 100);
  if v_card.level + p_levels > v_max then raise exception 'max_level'; end if;

  v_level := v_card.level;
  for v_i in 1..p_levels loop
    v_cost := public.card_upgrade_cost(p_card_id, v_level);
    v_total_copies := v_total_copies + (v_cost ->> 'copies')::integer;
    v_total_coins  := v_total_coins + (v_cost ->> 'coins')::numeric;
    v_level := v_level + 1;
  end loop;

  -- La primera copia está protegida: solo se pueden gastar las repetidas
  if v_card.copies - 1 < v_total_copies then raise exception 'insufficient_copies'; end if;

  -- Antes de cambiar el ritmo de producción se cobra lo acumulado al ritmo antiguo
  perform public.settle_player(v_uid);

  update public.player_economy
     set coins = coins - v_total_coins, updated_at = now()
   where user_id = v_uid and coins >= v_total_coins
   returning coins into v_coins;
  if not found then raise exception 'insufficient_funds'; end if;

  select coalesce((upgrades ->> 'prod_mult')::numeric, 1) into v_mult
  from public.player_progress where user_id = v_uid;
  v_new_prod := public.calc_card_production(p_card_id, v_level, v_mult);

  update public.player_cards
     set copies = copies - v_total_copies, level = v_level, production_per_sec = v_new_prod
   where user_id = v_uid and card_id = p_card_id;

  update public.player_economy
     set production_per_sec = greatest(production_per_sec - v_card.production_per_sec + v_new_prod, 0),
         updated_at = now()
   where user_id = v_uid;

  return jsonb_build_object(
    'coins', v_coins::text,
    'level', v_level,
    'copies', v_card.copies - v_total_copies,
    'old_production', v_card.production_per_sec::text,
    'production_per_sec', v_new_prod::text,
    'spent_copies', v_total_copies,
    'spent_coins', v_total_coins::text,
    'server_time', now()
  );
end;
$$;

-- ===================== 5. VENDER REPETIDAS (UNA CARTA) =======================
-- p_expected_copies evita dobles envíos. Siempre se conserva la primera copia.
create or replace function public.sell_card_duplicates(p_card_id text, p_quantity integer, p_expected_copies integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_copies integer;
  v_each   numeric;
  v_total  numeric;
  v_coins  numeric;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_quantity is null or p_quantity < 1 then raise exception 'invalid_quantity'; end if;

  perform 1 from public.player_economy where user_id = v_uid for update;

  select copies into v_copies
  from public.player_cards where user_id = v_uid and card_id = p_card_id for update;
  if not found then raise exception 'card_not_owned'; end if;
  if v_copies <> p_expected_copies then raise exception 'state_changed'; end if;
  if p_quantity > v_copies - 1 then raise exception 'no_duplicates'; end if;

  v_each := greatest(floor(public.calc_card_production(p_card_id, 1, 1)
                           * coalesce((public.cfg('upgrades') -> 'sell' ->> 'seconds')::numeric, 300)), 1);
  v_total := v_each * p_quantity;

  update public.player_cards set copies = copies - p_quantity
   where user_id = v_uid and card_id = p_card_id;

  update public.player_economy
     set coins = least(coins + v_total, 1e29), updated_at = now()
   where user_id = v_uid
   returning coins into v_coins;

  return jsonb_build_object('coins', v_coins::text, 'sold', p_quantity, 'earned', v_total::text,
                            'copies', v_copies - p_quantity);
end;
$$;

-- ===================== 6. VENDER REPETIDAS EN MASA ==========================
-- Sin confirmar solo CALCULA (vista previa). Al confirmar, p_expected_coins debe coincidir con lo
-- que el jugador vio: si sus cartas cambiaron entre medias, se rechaza sin vender nada.
create or replace function public.sell_duplicates_bulk(
  p_rarities text[], p_include_variants boolean default false,
  p_confirm boolean default false, p_expected_coins numeric default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_seconds numeric;
  v_cards   bigint;
  v_copies  bigint;
  v_coins   numeric;
  v_new     numeric;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_rarities is null or cardinality(p_rarities) < 1 or cardinality(p_rarities) > 12 then
    raise exception 'invalid_quantity';
  end if;

  perform 1 from public.player_economy where user_id = v_uid for update;

  v_seconds := coalesce((public.cfg('upgrades') -> 'sell' ->> 'seconds')::numeric, 300);

  select count(*),
         coalesce(sum(pc.copies - 1), 0),
         coalesce(sum((pc.copies - 1) * greatest(floor(public.calc_card_production(pc.card_id, 1, 1) * v_seconds), 1)), 0)
    into v_cards, v_copies, v_coins
  from public.player_cards pc
  join public.catalog_cards cc on cc.card_id = pc.card_id
  where pc.user_id = v_uid
    and pc.copies > 1
    and cc.rarity = any (p_rarities)
    and (p_include_variants
         or not (coalesce((cc.meta ->> 'alt')::boolean, false)
              or coalesce((cc.meta ->> 'manga')::boolean, false)
              or coalesce((cc.meta ->> 'sp')::boolean, false)));

  if not p_confirm then
    return jsonb_build_object('confirmed', false, 'cards', v_cards, 'copies', v_copies, 'coins', v_coins::text);
  end if;

  if p_expected_coins is not null and p_expected_coins <> v_coins then raise exception 'state_changed'; end if;
  if v_copies = 0 then raise exception 'no_duplicates'; end if;

  update public.player_cards pc
     set copies = 1
    from public.catalog_cards cc
   where cc.card_id = pc.card_id
     and pc.user_id = v_uid
     and pc.copies > 1
     and cc.rarity = any (p_rarities)
     and (p_include_variants
          or not (coalesce((cc.meta ->> 'alt')::boolean, false)
               or coalesce((cc.meta ->> 'manga')::boolean, false)
               or coalesce((cc.meta ->> 'sp')::boolean, false)));

  update public.player_economy
     set coins = least(coins + v_coins, 1e29), updated_at = now()
   where user_id = v_uid
   returning coins into v_new;

  return jsonb_build_object('confirmed', true, 'cards', v_cards, 'copies', v_copies,
                            'coins', v_coins::text, 'coins_total', v_new::text);
end;
$$;

-- ===================== 7. MEJORAS GLOBALES ==================================
create or replace function public.list_upgrades()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_up    jsonb;
  v_state jsonb;
  v_out   jsonb := '[]'::jsonb;
  v_level integer;
  v_max   integer;
  v_cost  numeric;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select coalesce(upgrades -> 'levels', '{}'::jsonb) into v_state
  from public.player_progress where user_id = v_uid;

  for v_up in select value from jsonb_array_elements(coalesce(public.cfg('upgrades') -> 'global', '[]'::jsonb)) loop
    v_level := coalesce((v_state ->> (v_up ->> 'id'))::integer, 0);
    v_max := coalesce((v_up ->> 'max_level')::integer, 1);
    if v_level >= v_max then
      v_cost := null;
    else
      v_cost := ceil((v_up ->> 'base_cost')::numeric * power(coalesce((v_up ->> 'growth')::numeric, 1.3), v_level));
    end if;
    v_out := v_out || jsonb_build_object(
      'id', v_up ->> 'id', 'name', v_up ->> 'name', 'description', v_up ->> 'description',
      'type', v_up ->> 'type', 'per_level', (v_up ->> 'per_level')::numeric,
      'level', v_level, 'max_level', v_max, 'next_cost', v_cost::text);
  end loop;
  return v_out;
end;
$$;

create or replace function public.buy_upgrade(p_upgrade_id text, p_expected_level integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_up    jsonb;
  v_level integer;
  v_max   integer;
  v_cost  numeric;
  v_coins numeric;
  v_per   numeric;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select value into v_up
  from jsonb_array_elements(coalesce(public.cfg('upgrades') -> 'global', '[]'::jsonb))
  where value ->> 'id' = p_upgrade_id
  limit 1;
  if v_up is null then raise exception 'upgrade_not_found'; end if;

  perform 1 from public.player_economy where user_id = v_uid for update;

  select coalesce((upgrades -> 'levels' ->> p_upgrade_id)::integer, 0) into v_level
  from public.player_progress where user_id = v_uid for update;
  if v_level <> p_expected_level then raise exception 'state_changed'; end if;

  v_max := coalesce((v_up ->> 'max_level')::integer, 1);
  if v_level >= v_max then raise exception 'max_level'; end if;

  v_cost := ceil((v_up ->> 'base_cost')::numeric * power(coalesce((v_up ->> 'growth')::numeric, 1.3), v_level));

  perform public.settle_player(v_uid);

  update public.player_economy
     set coins = coins - v_cost, updated_at = now()
   where user_id = v_uid and coins >= v_cost
   returning coins into v_coins;
  if not found then raise exception 'insufficient_funds'; end if;

  v_level := v_level + 1;
  v_per := coalesce((v_up ->> 'per_level')::numeric, 0);

  update public.player_progress
     set upgrades = jsonb_set(coalesce(upgrades, '{}'::jsonb), '{levels}',
                              coalesce(upgrades -> 'levels', '{}'::jsonb) || jsonb_build_object(p_upgrade_id, v_level))
   where user_id = v_uid;

  if v_up ->> 'type' = 'prod_mult' then
    update public.player_progress
       set upgrades = upgrades || jsonb_build_object('prod_mult', 1 + v_level * v_per)
     where user_id = v_uid;
    perform public.recalc_player_production(v_uid);
  elsif v_up ->> 'type' = 'storage_seconds' then
    update public.player_progress
       set upgrades = upgrades || jsonb_build_object('storage_bonus_seconds', v_level * v_per)
     where user_id = v_uid;
  end if;

  return jsonb_build_object('coins', v_coins::text, 'level', v_level, 'id', p_upgrade_id);
end;
$$;

-- ============================ 8. PERMISOS ====================================
-- Se vuelve a cerrar TODO y se abre solo lo necesario (incluye las funciones de fases anteriores).
revoke execute on all functions in schema public from PUBLIC, anon, authenticated;

grant execute on function public.is_admin()                                       to authenticated;
grant execute on function public.bootstrap_session()                              to authenticated;
grant execute on function public.collect_all()                                    to authenticated;
grant execute on function public.collect_card(text)                               to authenticated;
grant execute on function public.buy_pack(text, integer, uuid)                   to authenticated;
grant execute on function public.open_pack(text, uuid)                            to authenticated;
grant execute on function public.card_upgrade_info(text)                          to authenticated;
grant execute on function public.upgrade_card(text, integer, integer)             to authenticated;
grant execute on function public.sell_card_duplicates(text, integer, integer)     to authenticated;
grant execute on function public.sell_duplicates_bulk(text[], boolean, boolean, numeric) to authenticated;
grant execute on function public.list_upgrades()                                  to authenticated;
grant execute on function public.buy_upgrade(text, integer)                       to authenticated;
grant execute on function public.admin_list_users(text)                           to authenticated;
grant execute on function public.admin_give_coins(text, numeric)                  to authenticated;
grant execute on function public.admin_set_coins(text, numeric)                   to authenticated;
grant execute on function public.admin_give_pack(text, text, integer)             to authenticated;
grant execute on function public.admin_reset_user(text)                           to authenticated;
grant execute on function public.admin_give_card(text, text, integer)             to authenticated;
grant execute on function public.admin_set_card_level(text, text, integer)        to authenticated;
grant execute on function public.admin_recalc_all()                               to authenticated;
grant execute on function public.admin_sync_products()                            to authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer)       to service_role;
