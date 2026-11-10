-- ============================================================================
-- One Piece TCG Idle - FASE 5: economía idle
-- Se puede ejecutar varias veces. NO pisa los valores que cambies en game_config.
-- ============================================================================

-- ===================== 1. CONFIGURACIÓN POR DEFECTO ==========================
-- Todo se puede cambiar desde Supabase > Table Editor > game_config (clave "economy").
-- Después de cambiarla, pulsa "Recalcular producción de todos" en el menú F2.
insert into public.game_config (key, value, is_public, description) values
  ('economy', $json$
  {
    "base_by_rarity": {"C":0.2,"UC":0.5,"R":1.5,"SR":5,"SEC":20,"L":3,"TR":40,"PR":2,"P":2,"SP":10,"DON":0.1,"_default":1},
    "variant_mult":   {"alt":2,"sp":4,"manga":6},
    "set_mult_by_kind": {"booster":1,"extra_booster":1.2,"premium_booster":1.5,"starter_deck":0.8,"promo":1.3,"don":0.5,"other":1},
    "set_mult_overrides": {},
    "level_step": 0.1,
    "milestone_every": 25,
    "milestone_mult": 2
  }
  $json$::jsonb, true,
  'Producción: base por rareza x variante x set x nivel x mejoras. Nivel: (1+(n-1)*level_step) * milestone_mult^floor(n/milestone_every)')
on conflict (key) do nothing;

-- ========================= 2. FUNCIONES INTERNAS =============================
-- (No se pueden llamar desde el navegador: solo las usan las funciones del juego.)

create or replace function public.cfg(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select value from public.game_config where key = p_key;
$$;

-- Segundos máximos que una carta acumula sin recoger (config + mejoras del jugador)
create or replace function public.storage_cap_seconds(p_user uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (value #>> '{}')::numeric from public.game_config where key = 'offline_cap_seconds'), 28800)
       + coalesce((select (upgrades ->> 'storage_bonus_seconds')::numeric
                   from public.player_progress where user_id = p_user), 0);
$$;

-- Monedas enteras acumuladas por una carta (siempre con el reloj del SERVIDOR)
create or replace function public.accrued_coins(p_prod numeric, p_last timestamptz, p_cap numeric)
returns numeric
language sql
stable
set search_path = ''
as $$
  select floor(p_prod * least(greatest(extract(epoch from (now() - p_last)), 0), p_cap));
$$;

-- Nueva marca de tiempo tras recoger: conserva la fracción de moneda que no se pudo pagar
create or replace function public.next_collect_time(p_prod numeric, p_last timestamptz, p_cap numeric)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
    when p_prod <= 0 then now()
    when extract(epoch from (now() - p_last)) >= p_cap then now()
    when extract(epoch from (now() - p_last)) <= 0 then p_last
    else p_last + make_interval(secs => (floor(p_prod * extract(epoch from (now() - p_last))) / p_prod)::double precision)
  end;
$$;

-- Producción por segundo de UNA carta
create or replace function public.calc_card_production(p_card_id text, p_level integer, p_prod_mult numeric)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cfg     jsonb := coalesce(public.cfg('economy'), '{}'::jsonb);
  v_rarity  text;
  v_set     text;
  v_meta    jsonb;
  v_kind    text;
  v_base    numeric;
  v_variant numeric := 1;
  v_setmult numeric;
  v_step    numeric;
  v_every   integer;
  v_mmult   numeric;
  v_levelf  numeric;
begin
  select c.rarity, c.set_id, c.meta, s.kind
    into v_rarity, v_set, v_meta, v_kind
  from public.catalog_cards c
  join public.catalog_sets s on s.set_id = c.set_id
  where c.card_id = p_card_id;

  if v_rarity is null then
    return 0;
  end if;

  v_base := coalesce((v_cfg #>> array['base_by_rarity', v_rarity])::numeric,
                     (v_cfg #>> '{base_by_rarity,_default}')::numeric, 1);

  if coalesce((v_meta ->> 'manga')::boolean, false) then
    v_variant := coalesce((v_cfg #>> '{variant_mult,manga}')::numeric, 6);
  elsif coalesce((v_meta ->> 'sp')::boolean, false) then
    v_variant := coalesce((v_cfg #>> '{variant_mult,sp}')::numeric, 4);
  elsif coalesce((v_meta ->> 'alt')::boolean, false) then
    v_variant := coalesce((v_cfg #>> '{variant_mult,alt}')::numeric, 2);
  end if;

  v_setmult := coalesce((v_cfg #>> array['set_mult_overrides', v_set])::numeric,
                        (v_cfg #>> array['set_mult_by_kind', v_kind])::numeric, 1);

  v_step  := coalesce((v_cfg ->> 'level_step')::numeric, 0.1);
  v_every := greatest(coalesce((v_cfg ->> 'milestone_every')::integer, 25), 1);
  v_mmult := coalesce((v_cfg ->> 'milestone_mult')::numeric, 2);
  v_levelf := (1 + (p_level - 1) * v_step) * power(v_mmult, floor(p_level::numeric / v_every));

  return round(v_base * v_variant * v_setmult * v_levelf * greatest(coalesce(p_prod_mult, 1), 0), 4);
end;
$$;

-- Paga al jugador todo lo acumulado (con el ritmo ACTUAL) y reinicia los contadores.
create or replace function public.settle_player(p_user uuid)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cap  numeric;
  v_gain numeric;
begin
  perform 1 from public.player_economy where user_id = p_user for update;
  v_cap := public.storage_cap_seconds(p_user);

  select coalesce(sum(public.accrued_coins(c.production_per_sec, c.last_collected_at, v_cap)), 0)
    into v_gain
  from public.player_cards c
  where c.user_id = p_user;

  update public.player_cards c
     set last_collected_at = public.next_collect_time(c.production_per_sec, c.last_collected_at, v_cap)
   where c.user_id = p_user;

  update public.player_economy
     set coins = least(coins + v_gain, 1e29),
         total_earned = least(total_earned + v_gain, 1e35),
         updated_at = now()
   where user_id = p_user;

  return v_gain;
end;
$$;

-- Recalcula la producción de todas las cartas del jugador (primero le paga lo pendiente).
-- Hay que llamarla cuando cambie una carta, un nivel o una mejora, o la configuración.
create or replace function public.recalc_player_production(p_user uuid)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mult  numeric;
  v_total numeric;
begin
  perform public.settle_player(p_user);

  select coalesce((upgrades ->> 'prod_mult')::numeric, 1) into v_mult
  from public.player_progress where user_id = p_user;

  update public.player_cards c
     set production_per_sec = public.calc_card_production(c.card_id, c.level, coalesce(v_mult, 1))
   where c.user_id = p_user;

  select coalesce(sum(production_per_sec), 0) into v_total
  from public.player_cards where user_id = p_user;

  update public.player_economy
     set production_per_sec = v_total, updated_at = now()
   where user_id = p_user;

  return v_total;
end;
$$;

-- ====================== 3. FUNCIONES DEL JUGADOR (RPC) =======================

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
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  v_gain := public.settle_player(v_uid);
  select coins into v_coins from public.player_economy where user_id = v_uid;
  return jsonb_build_object('collected', v_gain::text, 'coins', v_coins::text, 'server_time', now());
end;
$$;

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

-- ========================= 4. FUNCIONES ADMIN NUEVAS =========================

create or replace function public.admin_give_card(p_username text, p_card_id text, p_quantity integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin  uuid := auth.uid();
  v_target uuid;
  v_total  integer;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 1000 then
    raise exception 'invalid_quantity';
  end if;
  select id into v_target from public.profiles where username_lower = lower(p_username);
  if v_target is null then raise exception 'user_not_found'; end if;
  if not exists (select 1 from public.catalog_cards where card_id = p_card_id) then
    raise exception 'card_not_found';
  end if;

  perform 1 from public.player_economy where user_id = v_target for update;

  insert into public.player_cards as pc (user_id, card_id, copies)
  values (v_target, p_card_id, p_quantity)
  on conflict (user_id, card_id) do update set copies = pc.copies + excluded.copies
  returning pc.copies into v_total;

  if v_total > 1000000 then raise exception 'too_many_copies'; end if;

  perform public.recalc_player_production(v_target);

  insert into public.admin_log (admin_id, target_user_id, action, details)
  values (v_admin, v_target, 'give_card',
          jsonb_build_object('card_id', p_card_id, 'quantity', p_quantity, 'now_has', v_total));
  return v_total;
end;
$$;

create or replace function public.admin_set_card_level(p_username text, p_card_id text, p_level integer)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin  uuid := auth.uid();
  v_target uuid;
  v_total  numeric;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_level is null or p_level < 1 or p_level > 100 then
    raise exception 'invalid_level';
  end if;
  select id into v_target from public.profiles where username_lower = lower(p_username);
  if v_target is null then raise exception 'user_not_found'; end if;

  perform 1 from public.player_economy where user_id = v_target for update;

  update public.player_cards set level = p_level
   where user_id = v_target and card_id = p_card_id;
  if not found then raise exception 'card_not_owned'; end if;

  v_total := public.recalc_player_production(v_target);

  insert into public.admin_log (admin_id, target_user_id, action, details)
  values (v_admin, v_target, 'set_card_level',
          jsonb_build_object('card_id', p_card_id, 'level', p_level));
  return v_total;
end;
$$;

create or replace function public.admin_recalc_all()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := auth.uid();
  v_user  uuid;
  v_count integer := 0;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  for v_user in select id from public.profiles loop
    perform public.recalc_player_production(v_user);
    v_count := v_count + 1;
  end loop;
  insert into public.admin_log (admin_id, target_user_id, action, details)
  values (v_admin, null, 'recalc_all', jsonb_build_object('players', v_count));
  return v_count;
end;
$$;

-- ============================ 5. PERMISOS ====================================
-- Se vuelve a dejar TODO cerrado y se abre solo lo necesario (incluye las funciones de la Fase 3).
revoke execute on all functions in schema public from PUBLIC, anon, authenticated;

grant execute on function public.is_admin()                                   to authenticated;
grant execute on function public.bootstrap_session()                          to authenticated;
grant execute on function public.collect_all()                                to authenticated;
grant execute on function public.collect_card(text)                           to authenticated;
grant execute on function public.admin_list_users(text)                       to authenticated;
grant execute on function public.admin_give_coins(text, numeric)              to authenticated;
grant execute on function public.admin_set_coins(text, numeric)               to authenticated;
grant execute on function public.admin_give_pack(text, text, integer)         to authenticated;
grant execute on function public.admin_reset_user(text)                       to authenticated;
grant execute on function public.admin_give_card(text, text, integer)         to authenticated;
grant execute on function public.admin_set_card_level(text, text, integer)    to authenticated;
grant execute on function public.admin_recalc_all()                           to authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer)   to service_role;
