-- ============================================================================
-- One Piece TCG Idle - FASE 10: endurecimiento de seguridad
-- Se ejecuta DESPUÉS de las migraciones 0001-0004. Se puede ejecutar varias veces.
--
-- 1) Límite de frecuencia POR JUGADOR en las funciones del juego (antiabuso).
-- 2) Los objetos NUEVOS (tablas, funciones) dejan de nacer con permisos abiertos.
-- 3) Limpieza automática de la tabla de límites.
--
-- IMPORTANTE: las funciones de abajo se generan a partir de las de las migraciones 0002-0004
-- añadiéndoles UNA línea (enforce_rate_limit). Si en el futuro vuelves a ejecutar 0002, 0003 o
-- 0004, vuelve a ejecutar también este archivo (siempre el último).
-- ============================================================================

-- ===================== 1. LÍMITE DE FRECUENCIA POR JUGADOR ===================
-- Cuenta las llamadas de un jugador a una acción en una ventana de tiempo. Si se pasa, rechaza.
-- (Si la acción falla por otro motivo, la transacción se deshace y esa llamada no cuenta.)
create or replace function public.enforce_rate_limit(p_action text, p_max integer, p_window_seconds integer)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not public.consume_rate_limit('fn:' || p_action || ':' || v_uid::text, p_max, p_window_seconds) then
    raise exception 'rate_limited';
  end if;
  -- Limpieza ocasional (1 de cada 100 llamadas): borra contadores de hace más de 2 días
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;
end;
$$;

-- collect_all: máx. 120 llamadas cada 60 s (origen: migración 0002)
create or replace function public.collect_all()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_gain  numeric;
  v_coins numeric;
begin
  perform public.enforce_rate_limit('collect_all', 120, 60);
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  v_gain := public.settle_player(v_uid);
  select coins into v_coins from public.player_economy where user_id = v_uid;
  return jsonb_build_object('collected', v_gain::text, 'coins', v_coins::text, 'server_time', now());
end;
$$;

-- collect_card: máx. 240 llamadas cada 60 s (origen: migración 0002)
create or replace function public.collect_card(p_card_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_card  record;
  v_cap   numeric;
  v_gain  numeric;
  v_coins numeric;
begin
  perform public.enforce_rate_limit('collect_card', 240, 60);
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  perform 1 from public.player_economy where user_id = v_uid for update;

  select production_per_sec, last_collected_at into v_card
  from public.player_cards
  where user_id = v_uid and card_id = p_card_id
  for update;
  if not found then
    raise exception 'card_not_owned';
  end if;

  v_cap  := public.storage_cap_seconds(v_uid);
  v_gain := public.accrued_coins(v_card.production_per_sec, v_card.last_collected_at, v_cap);

  update public.player_cards
     set last_collected_at = public.next_collect_time(v_card.production_per_sec, v_card.last_collected_at, v_cap)
   where user_id = v_uid and card_id = p_card_id;

  update public.player_economy
     set coins = least(coins + v_gain, 1e29),
         total_earned = least(total_earned + v_gain, 1e35),
         updated_at = now()
   where user_id = v_uid
   returning coins into v_coins;

  return jsonb_build_object('collected', v_gain::text, 'coins', v_coins::text, 'server_time', now());
end;
$$;

-- buy_pack: máx. 60 llamadas cada 60 s (origen: migración 0003)
create or replace function public.buy_pack(p_product_id text, p_quantity integer, p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_prev  record;
  v_price numeric;
  v_cost  numeric;
  v_coins numeric;
  v_owned integer;
begin
  perform public.enforce_rate_limit('buy_pack', 60, 60);
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_request_id is null then raise exception 'invalid_request'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 100 then raise exception 'invalid_quantity'; end if;

  perform 1 from public.player_economy where user_id = v_uid for update;

  -- Petición repetida: devuelve el estado actual sin cobrar otra vez
  select * into v_prev from public.purchase_history where user_id = v_uid and request_id = p_request_id;
  if found then
    select coins into v_coins from public.player_economy where user_id = v_uid;
    select quantity into v_owned from public.player_packs where user_id = v_uid and product_id = v_prev.product_id;
    return jsonb_build_object('coins', v_coins::text, 'owned', coalesce(v_owned, 0), 'duplicate_request', true);
  end if;

  select price into v_price from public.pack_products where product_id = p_product_id and enabled;
  if not found then raise exception 'product_not_found'; end if;
  v_cost := v_price * p_quantity;

  update public.player_economy
     set coins = coins - v_cost, updated_at = now()
   where user_id = v_uid and coins >= v_cost
   returning coins into v_coins;
  if not found then raise exception 'insufficient_funds'; end if;

  insert into public.player_packs as pp (user_id, product_id, quantity)
  values (v_uid, p_product_id, p_quantity)
  on conflict (user_id, product_id) do update set quantity = pp.quantity + excluded.quantity
  returning pp.quantity into v_owned;

  insert into public.purchase_history (user_id, request_id, product_id, quantity, cost)
  values (v_uid, p_request_id, p_product_id, p_quantity, v_cost);

  return jsonb_build_object('coins', v_coins::text, 'owned', v_owned);
end;
$$;

-- open_pack: máx. 300 llamadas cada 60 s (origen: migración 0003)
create or replace function public.open_pack(p_product_id text, p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_prev      jsonb;
  v_product   record;
  v_slot      jsonb;
  v_n         integer;
  v_i         integer;
  v_tier      text;
  v_card      text;
  v_cards     text[] := '{}';
  v_exists    boolean;
  v_mult      numeric;
  v_prod      numeric;
  v_new_prod  numeric := 0;
  v_result    jsonb := '[]'::jsonb;
  v_remaining integer;
begin
  perform public.enforce_rate_limit('open_pack', 300, 60);
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_request_id is null then raise exception 'invalid_request'; end if;

  perform 1 from public.player_economy where user_id = v_uid for update;

  -- Petición repetida: devuelve el MISMO resultado ya guardado
  select cards into v_prev from public.pack_history where user_id = v_uid and request_id = p_request_id;
  if found then
    return jsonb_build_object('cards', v_prev, 'duplicate_request', true, 'server_time', now());
  end if;

  select * into v_product from public.pack_products where product_id = p_product_id and enabled;
  if not found then raise exception 'product_not_found'; end if;

  -- Consumir un sobre del inventario
  update public.player_packs
     set quantity = quantity - 1
   where user_id = v_uid and product_id = p_product_id and quantity > 0
   returning quantity into v_remaining;
  if not found then raise exception 'no_packs'; end if;
  delete from public.player_packs where user_id = v_uid and product_id = p_product_id and quantity = 0;

  -- Generar las cartas
  if coalesce(v_product.config ->> 'mode', 'random') = 'fixed' then
    select coalesce(array_agg(c.card_id order by c.card_id), '{}') into v_cards
    from public.catalog_cards c
    where c.set_id = v_product.set_id
      and c.variant = 'base'
      and not coalesce((c.meta ->> 'retired')::boolean, false)
      and c.card_type <> 'don';
  else
    for v_slot in select value from jsonb_array_elements(coalesce(v_product.config -> 'slots', '[]'::jsonb)) loop
      v_n := greatest(coalesce((v_slot ->> 'count')::integer, 1), 1);
      for v_i in 1..v_n loop
        v_tier := public.pick_weighted(v_slot -> 'weights');
        v_card := coalesce(
          public.pick_card_for_tier(v_product.set_id, v_tier),
          public.pick_card_for_tier(v_product.set_id, 'R'),
          public.pick_card_for_tier(v_product.set_id, 'UC'),
          public.pick_card_for_tier(v_product.set_id, 'C'),
          (select c.card_id from public.catalog_cards c
            where c.set_id = v_product.set_id and c.card_type <> 'don'
            order by random() limit 1)
        );
        if v_card is not null then
          v_cards := v_cards || v_card;
        end if;
      end loop;
    end loop;
  end if;

  if coalesce(array_length(v_cards, 1), 0) = 0 then
    raise exception 'empty_pack';
  end if;

  -- Guardar en la colección. Una carta nueva calcula su propia producción.
  select coalesce((upgrades ->> 'prod_mult')::numeric, 1) into v_mult
  from public.player_progress where user_id = v_uid;

  foreach v_card in array v_cards loop
    select exists(select 1 from public.player_cards where user_id = v_uid and card_id = v_card) into v_exists;
    if v_exists then
      update public.player_cards set copies = least(copies + 1, 1000000)
       where user_id = v_uid and card_id = v_card;
    else
      v_prod := public.calc_card_production(v_card, 1, coalesce(v_mult, 1));
      insert into public.player_cards (user_id, card_id, copies, level, production_per_sec)
      values (v_uid, v_card, 1, 1, v_prod);
      v_new_prod := v_new_prod + v_prod;
    end if;
    v_result := v_result || jsonb_build_object('card_id', v_card, 'is_new', not v_exists);
  end loop;

  update public.player_economy
     set production_per_sec = production_per_sec + v_new_prod, updated_at = now()
   where user_id = v_uid;
  update public.player_progress set packs_opened = packs_opened + 1 where user_id = v_uid;

  insert into public.pack_history (user_id, request_id, product_id, source, cost, cards)
  values (v_uid, p_request_id, p_product_id, 'inventory', 0, v_result);

  return jsonb_build_object('cards', v_result, 'remaining', v_remaining, 'server_time', now());
end;
$$;

-- card_upgrade_info: máx. 240 llamadas cada 60 s (origen: migración 0004)
create or replace function public.card_upgrade_info(p_card_id text)
returns jsonb
language plpgsql
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
  perform public.enforce_rate_limit('card_upgrade_info', 240, 60);
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

-- upgrade_card: máx. 120 llamadas cada 60 s (origen: migración 0004)
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
  perform public.enforce_rate_limit('upgrade_card', 120, 60);
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

-- sell_card_duplicates: máx. 120 llamadas cada 60 s (origen: migración 0004)
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
  perform public.enforce_rate_limit('sell_card_duplicates', 120, 60);
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

-- sell_duplicates_bulk: máx. 30 llamadas cada 60 s (origen: migración 0004)
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
  perform public.enforce_rate_limit('sell_duplicates_bulk', 30, 60);
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

-- buy_upgrade: máx. 60 llamadas cada 60 s (origen: migración 0004)
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
  perform public.enforce_rate_limit('buy_upgrade', 60, 60);
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

-- ===================== 2. PERMISOS POR DEFECTO DE OBJETOS FUTUROS ============
-- Supabase da por defecto permisos amplios a anon/authenticated sobre lo que se crea. Se cierra:
-- cualquier tabla o función nueva nace SIN acceso para ellos y hay que concedérselo a propósito.
-- OJO: el permiso de ejecución para PUBLIC es un valor por defecto GLOBAL de PostgreSQL; para quitarlo
-- hay que revocarlo SIN "in schema" (con "in schema" no tiene efecto).
do $$
begin
  alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
  alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
  alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated, PUBLIC;
  alter default privileges for role postgres revoke execute on functions from PUBLIC;
exception when others then
  raise notice 'No se pudieron endurecer los permisos por defecto: %', sqlerrm;
end;
$$;

-- ============================ 3. PERMISOS ====================================
-- Se vuelve a cerrar TODO y se abre solo lo necesario.
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
