-- ============================================================================
-- One Piece TCG Idle - FASE 7: sobres, tienda y apertura
-- Se puede ejecutar varias veces. NO pisa los productos que ya hayas editado.
-- ============================================================================

-- Historial de compras (protege contra compras duplicadas)
create table if not exists public.purchase_history (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  product_id text references public.pack_products(product_id) on update cascade on delete set null,
  quantity   integer not null check (quantity > 0),
  cost       numeric(30,0) not null check (cost >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, request_id)
);
create index if not exists purchase_history_user_idx on public.purchase_history (user_id, created_at desc);
alter table public.purchase_history enable row level security;

-- ===================== 1. ALEATORIEDAD (solo en el servidor) =================

-- Elige una clave de un objeto {"C": 85, "UC": 15} con probabilidad proporcional a su peso
create or replace function public.pick_weighted(p_weights jsonb)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_total numeric;
  v_roll  numeric;
  v_acc   numeric := 0;
  r       record;
begin
  select coalesce(sum(value::numeric), 0) into v_total from jsonb_each_text(p_weights);
  if v_total <= 0 then
    return null;
  end if;
  v_roll := random() * v_total;
  for r in select key, value::numeric as peso from jsonb_each_text(p_weights) order by key loop
    v_acc := v_acc + r.peso;
    if v_roll < v_acc then
      return r.key;
    end if;
  end loop;
  return (select key from jsonb_each_text(p_weights) order by key limit 1);
end;
$$;

-- Carta al azar de un set dentro de un "nivel": una rareza (C, UC, R, SR, SEC, L, TR...)
-- o una variante especial (ALT = arte alternativo, SP, MANGA). Excluye retiradas y DON!!
create or replace function public.pick_card_for_tier(p_set text, p_tier text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_card text;
begin
  select c.card_id into v_card
  from public.catalog_cards c
  where c.set_id = p_set
    and not coalesce((c.meta ->> 'retired')::boolean, false)
    and c.card_type <> 'don'
    and case p_tier
          when 'MANGA' then coalesce((c.meta ->> 'manga')::boolean, false)
          when 'SP' then coalesce((c.meta ->> 'sp')::boolean, false)
                         and not coalesce((c.meta ->> 'manga')::boolean, false)
          when 'ALT' then coalesce((c.meta ->> 'alt')::boolean, false)
                          and not coalesce((c.meta ->> 'manga')::boolean, false)
                          and not coalesce((c.meta ->> 'sp')::boolean, false)
          else c.rarity = p_tier
               and not coalesce((c.meta ->> 'alt')::boolean, false)
               and not coalesce((c.meta ->> 'manga')::boolean, false)
               and not coalesce((c.meta ->> 'sp')::boolean, false)
        end
  order by random()
  limit 1;
  return v_card;
end;
$$;

-- ===================== 2. PRODUCTOS (uno por set) ============================
-- Crea un producto por cada set booster / extra booster / premium booster / starter deck.
-- Las probabilidades son FICTICIAS (no oficiales). Se editan en pack_products.config.
create or replace function public.sync_pack_products()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aviso   text := 'Probabilidades ficticias de este juego. NO son las oficiales del TCG.';
  v_booster jsonb;
  v_premium jsonb;
  v_starter jsonb;
  v_count   integer;
begin
  v_booster := jsonb_build_object('mode', 'random', 'note', v_aviso, 'slots', jsonb_build_array(
    jsonb_build_object('count', 3, 'weights', jsonb_build_object('C', 85, 'UC', 15)),
    jsonb_build_object('count', 2, 'weights', jsonb_build_object('UC', 100)),
    jsonb_build_object('count', 1, 'weights', jsonb_build_object('R', 62, 'SR', 18, 'L', 6, 'ALT', 8, 'SEC', 3, 'SP', 2, 'MANGA', 1))
  ));
  v_premium := jsonb_build_object('mode', 'random', 'note', v_aviso, 'slots', jsonb_build_array(
    jsonb_build_object('count', 3, 'weights', jsonb_build_object('C', 85, 'UC', 15)),
    jsonb_build_object('count', 2, 'weights', jsonb_build_object('UC', 100)),
    jsonb_build_object('count', 1, 'weights', jsonb_build_object('R', 43, 'SR', 28, 'L', 6, 'ALT', 12, 'SEC', 5, 'SP', 3, 'MANGA', 1, 'TR', 2))
  ));
  v_starter := jsonb_build_object('mode', 'fixed', 'note', 'Contiene todas las cartas base del mazo.');

  with nuevos as (
    insert into public.pack_products (product_id, name, kind, set_id, price, config, enabled, sort_order)
    select s.set_id,
           s.name,
           s.kind,
           s.set_id,
           case s.kind
             when 'booster' then 1000 + 250 * coalesce(((regexp_match(s.set_id, '(\d+)'))[1])::integer, 1)
             when 'extra_booster' then 2500
             when 'premium_booster' then 6000
             else 3000
           end,
           (case s.kind
              when 'starter_deck' then v_starter
              when 'premium_booster' then v_premium
              else v_booster
            end)
           || (case when s.kind = 'booster' and s.set_id ~ '^OP[0-9]{2}$'
                    then jsonb_build_object('art_url', 'https://images.scrydex.com/onepiece/' || s.set_id || '-s1/large')
                    else '{}'::jsonb
               end),
           true,
           (case s.kind when 'booster' then 0 when 'extra_booster' then 1000 when 'premium_booster' then 2000 else 3000 end)
             + coalesce(((regexp_match(s.set_id, '(\d+)'))[1])::integer, 0)
    from public.catalog_sets s
    where s.kind in ('booster', 'extra_booster', 'premium_booster', 'starter_deck')
    on conflict (product_id) do nothing
    returning 1
  )
  select count(*) into v_count from nuevos;
  return v_count;
end;
$$;

create or replace function public.admin_sync_products()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := auth.uid();
  v_count integer;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  v_count := public.sync_pack_products();
  insert into public.admin_log (admin_id, target_user_id, action, details)
  values (v_admin, null, 'sync_products', jsonb_build_object('created', v_count));
  return v_count;
end;
$$;

-- ===================== 3. COMPRAR SOBRES ====================================
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

-- ===================== 4. ABRIR UN SOBRE ====================================
-- Todo se decide AQUÍ: el navegador solo recibe y anima el resultado.
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

-- ============================ 5. PERMISOS ====================================
revoke all on public.purchase_history from anon, authenticated;
grant select on public.purchase_history to authenticated;
drop policy if exists purchase_history_select on public.purchase_history;
create policy purchase_history_select on public.purchase_history
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

-- Crear ya los productos a partir de los sets del catálogo
select public.sync_pack_products();

-- Se vuelve a cerrar TODO y se abre solo lo necesario (incluye las funciones de fases anteriores)
revoke execute on all functions in schema public from PUBLIC, anon, authenticated;

grant execute on function public.is_admin()                                   to authenticated;
grant execute on function public.bootstrap_session()                          to authenticated;
grant execute on function public.collect_all()                                to authenticated;
grant execute on function public.collect_card(text)                           to authenticated;
grant execute on function public.buy_pack(text, integer, uuid)               to authenticated;
grant execute on function public.open_pack(text, uuid)                        to authenticated;
grant execute on function public.admin_list_users(text)                       to authenticated;
grant execute on function public.admin_give_coins(text, numeric)              to authenticated;
grant execute on function public.admin_set_coins(text, numeric)               to authenticated;
grant execute on function public.admin_give_pack(text, text, integer)         to authenticated;
grant execute on function public.admin_reset_user(text)                       to authenticated;
grant execute on function public.admin_give_card(text, text, integer)         to authenticated;
grant execute on function public.admin_set_card_level(text, text, integer)    to authenticated;
grant execute on function public.admin_recalc_all()                           to authenticated;
grant execute on function public.admin_sync_products()                        to authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer)   to service_role;
