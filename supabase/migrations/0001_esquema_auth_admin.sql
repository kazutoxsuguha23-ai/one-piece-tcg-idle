-- ============================================================================
-- One Piece TCG Idle - FASE 3: esquema, seguridad (RLS), autenticación y admin
-- Se puede ejecutar varias veces sin romper nada (es "re-ejecutable").
-- ============================================================================

-- ============================ 1. TABLAS =====================================

-- Catálogo (se rellena en la Fase 4 desde cards.json / sets.json)
create table if not exists public.catalog_sets (
  set_id       text primary key,
  name         text not null,
  kind         text not null default 'booster',
  release_date date,
  meta         jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);

create table if not exists public.catalog_cards (
  card_id    text primary key,                       -- identifica la carta EXACTA (incluye variante)
  set_id     text not null references public.catalog_sets(set_id) on update cascade,
  code       text not null,                          -- código base, p. ej. OP01-001
  name       text not null,
  rarity     text not null,
  card_type  text not null,
  variant    text not null default 'base',
  meta       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists catalog_cards_set_idx    on public.catalog_cards (set_id);
create index if not exists catalog_cards_rarity_idx on public.catalog_cards (set_id, rarity);

-- Configuración del juego (editable sin tocar código)
create table if not exists public.game_config (
  key         text primary key,
  value       jsonb not null,
  is_public   boolean not null default true,         -- false = solo la ve el servidor
  description text,
  updated_at  timestamptz not null default now()
);

-- Productos a la venta (sobres, boosters, starter decks...). Se rellena en la Fase 7.
create table if not exists public.pack_products (
  product_id text primary key,
  name       text not null,
  kind       text not null check (kind in ('booster','extra_booster','premium_booster','starter_deck','promo')),
  set_id     text references public.catalog_sets(set_id) on update cascade on delete set null,
  price      numeric(30,0) not null check (price >= 0),
  config     jsonb not null default '{}'::jsonb,     -- slots, probabilidades, garantías
  enabled    boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Jugadores
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  username       text not null,
  username_lower text generated always as (lower(username)) stored,
  role           text not null default 'player' check (role in ('player','admin')),
  created_at     timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]{3,20}$')
);
create unique index if not exists profiles_username_lower_key on public.profiles (username_lower);

create table if not exists public.player_economy (
  user_id            uuid primary key references public.profiles(id) on delete cascade,
  coins              numeric(30,0) not null default 0 check (coins >= 0),
  total_earned       numeric(36,0) not null default 0 check (total_earned >= 0),
  production_per_sec numeric(30,4) not null default 0 check (production_per_sec >= 0),
  updated_at         timestamptz not null default now()
);

create table if not exists public.player_cards (
  user_id            uuid not null references public.profiles(id) on delete cascade,
  card_id            text not null references public.catalog_cards(card_id) on update cascade,
  copies             integer not null check (copies >= 1),
  level              integer not null default 1 check (level between 1 and 100),
  production_per_sec numeric(30,4) not null default 0 check (production_per_sec >= 0),
  last_collected_at  timestamptz not null default now(),
  first_obtained_at  timestamptz not null default now(),
  primary key (user_id, card_id)
);
create index if not exists player_cards_card_idx on public.player_cards (card_id);

create table if not exists public.player_progress (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  upgrades     jsonb not null default '{}'::jsonb,
  stats        jsonb not null default '{}'::jsonb,
  packs_opened integer not null default 0 check (packs_opened >= 0),
  last_login_at timestamptz,
  created_at   timestamptz not null default now()
);

-- Sobres sin abrir (para que el admin pueda "dar sobres")
create table if not exists public.player_packs (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  product_id text not null references public.pack_products(product_id) on update cascade on delete cascade,
  quantity   integer not null check (quantity >= 0),
  primary key (user_id, product_id)
);

create table if not exists public.pack_history (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,                           -- protege contra peticiones duplicadas
  product_id text references public.pack_products(product_id) on update cascade on delete set null,
  source     text not null check (source in ('shop','inventory')),
  cost       numeric(30,0) not null default 0 check (cost >= 0),
  cards      jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, request_id)
);
create index if not exists pack_history_user_idx on public.pack_history (user_id, created_at desc);

create table if not exists public.admin_log (
  id             bigint generated always as identity primary key,
  admin_id       uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  action         text not null,
  details        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create table if not exists public.rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  count        integer not null default 0
);

-- ======================= 2. CONFIGURACIÓN INICIAL ===========================
insert into public.game_config (key, value, is_public, description) values
  ('registration_open',   'true'::jsonb,  true,  'true = se permiten registros nuevos'),
  ('invite_code',         'null'::jsonb,  false, 'Código de invitación obligatorio para registrarse (null = ninguno)'),
  ('starting_coins',      '500'::jsonb,   true,  'Monedas iniciales de una cuenta nueva'),
  ('offline_cap_seconds', '28800'::jsonb, true,  'Máximo de segundos de producción offline acumulables (8 h)')
on conflict (key) do nothing;

-- ========================= 3. FUNCIONES AUXILIARES ==========================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

-- Al crearse un usuario en Supabase Auth se crean automáticamente sus filas de juego.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := new.raw_user_meta_data ->> 'username';
  v_coins    numeric;
begin
  if v_username is null or v_username !~ '^[A-Za-z0-9_]{3,20}$' then
    raise exception 'invalid_username';
  end if;

  select (value #>> '{}')::numeric into v_coins
  from public.game_config where key = 'starting_coins';
  v_coins := coalesce(v_coins, 500);

  insert into public.profiles (id, username) values (new.id, v_username);
  insert into public.player_economy (user_id, coins) values (new.id, v_coins);
  insert into public.player_progress (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Límite de frecuencia (lo usa la Edge Function de registro)
create or replace function public.consume_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.rate_limits as r (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update set
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds)
                        then now() else r.window_start end,
    count        = case when r.window_start < now() - make_interval(secs => p_window_seconds)
                        then 1 else r.count + 1 end
  returning r.count into v_count;
  return v_count <= p_max;
end;
$$;

-- Estado inicial del jugador al abrir sesión (también sirve para recuperar sesión)
create or replace function public.bootstrap_session()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  update public.player_progress set last_login_at = now() where user_id = v_uid;

  select jsonb_build_object(
    'profile',  jsonb_build_object('id', p.id, 'username', p.username, 'role', p.role),
    'economy',  jsonb_build_object('coins', e.coins::text, 'production_per_sec', e.production_per_sec::text),
    'progress', jsonb_build_object('packs_opened', g.packs_opened, 'upgrades', g.upgrades, 'stats', g.stats),
    'server_time', now()
  ) into v_result
  from public.profiles p
  join public.player_economy e on e.user_id = p.id
  join public.player_progress g on g.user_id = p.id
  where p.id = v_uid;

  if v_result is null then
    raise exception 'profile_missing';
  end if;
  return v_result;
end;
$$;

-- ============================ 4. FUNCIONES ADMIN =============================
-- Todas comprueban is_admin() EN EL SERVIDOR y dejan rastro en admin_log.

create or replace function public.admin_list_users(p_search text default '')
returns table (uid uuid, uname text, urole text, ucoins text, upacks integer, ucreated timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  return query
    select p.id, p.username, p.role, e.coins::text, g.packs_opened, p.created_at
    from public.profiles p
    join public.player_economy e on e.user_id = p.id
    join public.player_progress g on g.user_id = p.id
    where coalesce(p_search, '') = '' or strpos(p.username_lower, lower(p_search)) > 0
    order by p.created_at desc
    limit 50;
end;
$$;

-- Suma (o resta, si es negativa) monedas
create or replace function public.admin_give_coins(p_username text, p_amount numeric)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin  uuid := auth.uid();
  v_target uuid;
  v_new    numeric;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_amount is null or p_amount = 0 or p_amount <> trunc(p_amount) or abs(p_amount) > 1e24 then
    raise exception 'invalid_amount';
  end if;
  select id into v_target from public.profiles where username_lower = lower(p_username);
  if v_target is null then raise exception 'user_not_found'; end if;

  update public.player_economy
     set coins = greatest(coins + p_amount, 0),
         updated_at = now()
   where user_id = v_target
   returning coins into v_new;

  insert into public.admin_log (admin_id, target_user_id, action, details)
  values (v_admin, v_target, 'give_coins',
          jsonb_build_object('amount', p_amount::text, 'new_balance', v_new::text));
  return v_new::text;
end;
$$;

create or replace function public.admin_set_coins(p_username text, p_amount numeric)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin  uuid := auth.uid();
  v_target uuid;
  v_new    numeric;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_amount is null or p_amount < 0 or p_amount <> trunc(p_amount) or p_amount > 1e24 then
    raise exception 'invalid_amount';
  end if;
  select id into v_target from public.profiles where username_lower = lower(p_username);
  if v_target is null then raise exception 'user_not_found'; end if;

  update public.player_economy
     set coins = p_amount, updated_at = now()
   where user_id = v_target
   returning coins into v_new;

  insert into public.admin_log (admin_id, target_user_id, action, details)
  values (v_admin, v_target, 'set_coins', jsonb_build_object('new_balance', v_new::text));
  return v_new::text;
end;
$$;

-- Da sobres / boosters / starter decks sin abrir (cualquier producto de pack_products)
create or replace function public.admin_give_pack(p_username text, p_product_id text, p_quantity integer)
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
  if not exists (select 1 from public.pack_products where product_id = p_product_id) then
    raise exception 'product_not_found';
  end if;

  insert into public.player_packs as pp (user_id, product_id, quantity)
  values (v_target, p_product_id, p_quantity)
  on conflict (user_id, product_id) do update set quantity = pp.quantity + excluded.quantity
  returning pp.quantity into v_total;

  insert into public.admin_log (admin_id, target_user_id, action, details)
  values (v_admin, v_target, 'give_pack',
          jsonb_build_object('product_id', p_product_id, 'quantity', p_quantity, 'now_has', v_total));
  return v_total;
end;
$$;

-- Deja la cuenta como nueva (conserva el nombre de usuario y el rol)
create or replace function public.admin_reset_user(p_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin  uuid := auth.uid();
  v_target uuid;
  v_start  numeric;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select id into v_target from public.profiles where username_lower = lower(p_username);
  if v_target is null then raise exception 'user_not_found'; end if;

  select (value #>> '{}')::numeric into v_start from public.game_config where key = 'starting_coins';
  v_start := coalesce(v_start, 500);

  delete from public.player_cards  where user_id = v_target;
  delete from public.player_packs  where user_id = v_target;
  delete from public.pack_history  where user_id = v_target;
  update public.player_economy
     set coins = v_start, total_earned = 0, production_per_sec = 0, updated_at = now()
   where user_id = v_target;
  update public.player_progress
     set upgrades = '{}'::jsonb, stats = '{}'::jsonb, packs_opened = 0
   where user_id = v_target;

  insert into public.admin_log (admin_id, target_user_id, action, details)
  values (v_admin, v_target, 'reset_user', '{}'::jsonb);
end;
$$;

-- ===================== 5. PERMISOS Y SEGURIDAD (RLS) =========================

alter table public.catalog_sets   enable row level security;
alter table public.catalog_cards  enable row level security;
alter table public.game_config    enable row level security;
alter table public.pack_products  enable row level security;
alter table public.profiles       enable row level security;
alter table public.player_economy enable row level security;
alter table public.player_cards   enable row level security;
alter table public.player_progress enable row level security;
alter table public.player_packs   enable row level security;
alter table public.pack_history   enable row level security;
alter table public.admin_log      enable row level security;
alter table public.rate_limits    enable row level security;

-- Quitar TODO permiso a los roles del navegador y dar solo lectura donde toca.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from PUBLIC, anon, authenticated;

grant select on public.game_config to anon, authenticated;
grant select on public.catalog_sets, public.catalog_cards, public.pack_products to authenticated;
grant select on public.profiles, public.player_economy, public.player_cards,
                public.player_progress, public.player_packs, public.pack_history,
                public.admin_log to authenticated;

-- Políticas (solo lectura; NUNCA hay políticas de escritura desde el navegador)
drop policy if exists game_config_select on public.game_config;
create policy game_config_select on public.game_config
  for select to anon, authenticated using (is_public);

drop policy if exists catalog_sets_select on public.catalog_sets;
create policy catalog_sets_select on public.catalog_sets
  for select to authenticated using (true);

drop policy if exists catalog_cards_select on public.catalog_cards;
create policy catalog_cards_select on public.catalog_cards
  for select to authenticated using (true);

drop policy if exists pack_products_select on public.pack_products;
create policy pack_products_select on public.pack_products
  for select to authenticated using (enabled or public.is_admin());

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (id = (select auth.uid()) or public.is_admin());

drop policy if exists player_economy_select on public.player_economy;
create policy player_economy_select on public.player_economy
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists player_cards_select on public.player_cards;
create policy player_cards_select on public.player_cards
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists player_progress_select on public.player_progress;
create policy player_progress_select on public.player_progress
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists player_packs_select on public.player_packs;
create policy player_packs_select on public.player_packs
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists pack_history_select on public.pack_history;
create policy pack_history_select on public.pack_history
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists admin_log_select on public.admin_log;
create policy admin_log_select on public.admin_log
  for select to authenticated using (public.is_admin());

-- Permiso para ejecutar funciones
grant execute on function public.is_admin()                              to authenticated;
grant execute on function public.bootstrap_session()                     to authenticated;
grant execute on function public.admin_list_users(text)                  to authenticated;
grant execute on function public.admin_give_coins(text, numeric)         to authenticated;
grant execute on function public.admin_set_coins(text, numeric)          to authenticated;
grant execute on function public.admin_give_pack(text, text, integer)    to authenticated;
grant execute on function public.admin_reset_user(text)                  to authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
