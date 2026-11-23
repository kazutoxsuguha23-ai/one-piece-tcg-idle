-- COMPRAR Y ABRIR SOBRES
do $$
declare
  v_alice uuid := t.login('alice');
  v_req uuid := gen_random_uuid();
  v_antes numeric;
  v_despues numeric;
  r jsonb;
begin
  perform public.sync_pack_products();
  perform t.ok((select count(*) from public.pack_products) = 5, 'se crean 5 productos: OP01, OP02, EB01, PRB01 y ST01 (no PROMO ni DON)');
  perform t.ok((select price from public.pack_products where product_id = 'OP01') = 1250, 'OP01 cuesta 1250');
  perform t.ok((select price from public.pack_products where product_id = 'EB01') = 2500, 'un extra booster cuesta 2500');
  perform t.ok((select price from public.pack_products where product_id = 'PRB01') = 6000, 'un premium booster cuesta 6000');
  perform t.ok((select price from public.pack_products where product_id = 'ST01') = 3000, 'un starter deck cuesta 3000');
  perform t.ok((select count(*) from public.pack_products where config ->> 'mode' = 'fixed') = 1, 'solo el starter deck tiene contenido fijo');
  perform t.ok((select config ->> 'note' from public.pack_products where product_id = 'OP01') like '%ficticias%',
               'las probabilidades están etiquetadas como ficticias (no oficiales)');
  perform t.ok((select sum(w.value::numeric) from public.pack_products p,
                  jsonb_array_elements(p.config -> 'slots') s,
                  jsonb_each_text(s.value -> 'weights') w
                where p.product_id = 'OP01' and (s.value ->> 'count')::integer = 1) = 100,
               'los pesos del hueco de premio suman 100');

  update public.player_economy set coins = 1000000 where user_id = v_alice;

  perform t.fails($q$select public.buy_pack('OP01', 0, gen_random_uuid())$q$, 'invalid_quantity', 'comprar 0 sobres da error');
  perform t.fails($q$select public.buy_pack('OP01', 101, gen_random_uuid())$q$, 'invalid_quantity', 'comprar más de 100 a la vez da error');
  perform t.fails($q$select public.buy_pack('OP01', -5, gen_random_uuid())$q$, 'invalid_quantity', 'una cantidad negativa da error');
  perform t.fails($q$select public.buy_pack('NOEXISTE', 1, gen_random_uuid())$q$, 'product_not_found', 'un producto inexistente da error');
  perform t.fails($q$select public.buy_pack('OP01', 1, null)$q$, 'invalid_request', 'sin identificador de petición da error');

  select coins into v_antes from public.player_economy where user_id = v_alice;
  r := public.buy_pack('OP01', 10, v_req);
  select coins into v_despues from public.player_economy where user_id = v_alice;
  perform t.ok(v_antes - v_despues = 12500, 'comprar 10 sobres de OP01 cuesta 12500');
  perform t.ok((r ->> 'owned')::integer = 10, 'ahora tiene 10 sobres');

  r := public.buy_pack('OP01', 10, v_req);
  perform t.ok((select coins from public.player_economy where user_id = v_alice) = v_despues, 'repetir la MISMA petición no cobra otra vez');
  perform t.ok((select quantity from public.player_packs where user_id = v_alice and product_id = 'OP01') = 10, 'repetir la petición no da más sobres');
  perform t.ok((r ->> 'duplicate_request')::boolean, 'se avisa de que era una petición repetida');
  perform t.ok((select count(*) from public.purchase_history where user_id = v_alice) = 1, 'solo queda 1 compra en el historial');

  -- Bob tiene 500 monedas: no le llega
  perform t.login('bob');
  perform t.fails($q$select public.buy_pack('OP01', 1, gen_random_uuid())$q$, 'insufficient_funds', 'sin monedas suficientes no se puede comprar');
  perform t.ok((select coins from public.player_economy e join public.profiles p on p.id = e.user_id where p.username_lower = 'bob') = 500, 'y no se le cobra nada');
  perform t.ok(not exists (select 1 from public.player_packs pp join public.profiles p on p.id = pp.user_id where p.username_lower = 'bob'), 'ni se le dan sobres');
end;
$$;

do $$
declare
  v_alice uuid := t.login('alice');
  v_bob uuid;
  v_req uuid := gen_random_uuid();
  r jsonb;
  r2 jsonb;
  v_prod numeric;
  v_suma numeric;
begin
  select id into v_bob from public.profiles where username_lower = 'bob';

  r := public.open_pack('OP01', v_req);
  perform t.ok(jsonb_array_length(r -> 'cards') = 6, 'un sobre de OP01 trae 6 cartas');
  perform t.ok((r ->> 'remaining')::integer = 9, 'quedan 9 sobres');
  perform t.ok((select sum(copies) from public.player_cards where user_id = v_alice) = 6, 'las 6 cartas están en su colección');
  perform t.ok((select packs_opened from public.player_progress where user_id = v_alice) = 1, 'se cuenta 1 sobre abierto');
  perform t.ok((select count(*) from public.pack_history where user_id = v_alice) = 1, 'queda 1 apertura en el historial');
  perform t.ok((select count(*) from jsonb_array_elements(r -> 'cards') e where (e ->> 'is_new')::boolean)
               = (select count(distinct e ->> 'card_id') from jsonb_array_elements(r -> 'cards') e),
               'en un sobre sin cartas previas, cada carta distinta se marca como nueva UNA vez');
  perform t.ok((select rarity from public.catalog_cards where card_id = (r -> 'cards' -> 3 ->> 'card_id')) = 'UC', 'el hueco 4 es un poco común');
  perform t.ok((select rarity from public.catalog_cards where card_id = (r -> 'cards' -> 4 ->> 'card_id')) = 'UC', 'el hueco 5 es un poco común');

  r2 := public.open_pack('OP01', v_req);
  perform t.ok(r2 -> 'cards' = r -> 'cards', 'repetir la petición devuelve LAS MISMAS cartas');
  perform t.ok((select quantity from public.player_packs where user_id = v_alice and product_id = 'OP01') = 9, 'repetir la petición NO consume otro sobre');
  perform t.ok((select sum(copies) from public.player_cards where user_id = v_alice) = 6, 'repetir la petición NO duplica las cartas');
  perform t.ok((select packs_opened from public.player_progress where user_id = v_alice) = 1, 'repetir la petición NO cuenta otra apertura');

  select production_per_sec into v_prod from public.player_economy where user_id = v_alice;
  select coalesce(sum(production_per_sec), 0) into v_suma from public.player_cards where user_id = v_alice;
  perform t.ok(abs(v_prod - v_suma) < 0.001, 'la producción total coincide con la suma de sus cartas');

  -- Sin sobres, o con un set sin cartas
  perform t.login('bob');
  perform t.fails($q$select public.open_pack('OP01', gen_random_uuid())$q$, 'no_packs', 'sin sobres no se puede abrir');
  insert into public.player_packs (user_id, product_id, quantity) values (v_bob, 'OP02', 1);
  perform t.fails($q$select public.open_pack('OP02', gen_random_uuid())$q$, 'empty_pack', 'un set sin cartas da error');
  perform t.ok((select quantity from public.player_packs where user_id = v_bob and product_id = 'OP02') = 1,
               'si la apertura falla NO se pierde el sobre (operación atómica)');
  perform t.fails($q$select public.open_pack('OP01', null)$q$, 'invalid_request', 'sin identificador de petición da error');
  perform t.fails($q$select public.open_pack('NOEXISTE', gen_random_uuid())$q$, 'product_not_found', 'un producto inexistente da error');

  -- Starter deck: contenido fijo
  perform t.login('alice');
  insert into public.player_packs (user_id, product_id, quantity) values (v_alice, 'ST01', 1);
  r := public.open_pack('ST01', gen_random_uuid());
  perform t.ok(jsonb_array_length(r -> 'cards') = 10, 'el starter deck trae sus 10 cartas base');
  perform t.ok((select count(distinct e ->> 'card_id') from jsonb_array_elements(r -> 'cards') e) = 10, 'sin repetir ninguna');
  perform t.ok(not exists (select 1 from jsonb_array_elements(r -> 'cards') e
                           join public.catalog_cards c on c.card_id = (e ->> 'card_id') where c.variant <> 'base'),
               'el starter deck NO trae las versiones de arte alternativo');

  -- Nunca salen cartas DON!! ni promos
  perform t.ok(not exists (select 1 from public.player_cards where user_id = v_alice and card_id in ('DON-001', 'PROMO-001')), 'nunca salen cartas DON!! ni promos en un sobre');
end;
$$;
