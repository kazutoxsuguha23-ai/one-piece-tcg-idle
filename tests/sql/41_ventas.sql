-- VENDER REPETIDAS (dave)
do $$
declare
  v_dave uuid;
  r jsonb;
  v_antes numeric;
  v_despues numeric;
  v_n integer;
begin
  perform t.login('admin1');
  select id into v_dave from public.profiles where username_lower = 'dave';
  perform public.admin_give_card('dave', 'OP01-C010', 5);
  perform public.admin_give_card('dave', 'OP01-C011', 5);
  perform public.admin_give_card('dave', 'OP01-C012', 5);
  perform public.admin_give_card('dave', 'OP01-A001_p1', 5);   -- arte alternativo (SR)
  perform public.admin_give_card('dave', 'OP01-U001', 1);
  update public.player_economy set coins = 1000 where user_id = v_dave;
  perform t.login('dave');

  perform t.fails($q$select public.sell_card_duplicates('OP01-C010', 5, 5)$q$, 'no_duplicates', 'no se pueden vender las 5 copias: la primera está protegida');
  perform t.fails($q$select public.sell_card_duplicates('OP01-C010', 0, 5)$q$, 'invalid_quantity', 'vender 0 da error');
  perform t.fails($q$select public.sell_card_duplicates('OP01-C010', -1, 5)$q$, 'invalid_quantity', 'vender una cantidad negativa da error');
  perform t.fails($q$select public.sell_card_duplicates('OP01-C010', 1, 4)$q$, 'state_changed', 'si las copias no son las que viste, se rechaza');
  perform t.fails($q$select public.sell_card_duplicates('OP01-U002', 1, 1)$q$, 'card_not_owned', 'no se puede vender lo que no se tiene');
  perform t.fails($q$select public.sell_card_duplicates('OP01-U001', 1, 1)$q$, 'no_duplicates', 'con 1 sola copia no se puede vender nada');

  select coins into v_antes from public.player_economy where user_id = v_dave;
  r := public.sell_card_duplicates('OP01-C010', 4, 5);
  select coins into v_despues from public.player_economy where user_id = v_dave;
  perform t.ok((r ->> 'earned')::numeric = 240 and (r ->> 'sold')::integer = 4, 'vender 4 repetidas de una Común da 240 monedas');
  perform t.ok(v_despues = v_antes + 240, 'el saldo sube EXACTAMENTE 240');
  perform t.ok((select copies from public.player_cards where user_id = v_dave and card_id = 'OP01-C010') = 1, 'se queda con la primera copia');
  perform t.fails($q$select public.sell_card_duplicates('OP01-C010', 4, 5)$q$, 'state_changed', 'repetir la venta (doble clic) se rechaza');
  perform t.ok((select coins from public.player_economy where user_id = v_dave) = v_despues, 'y no vuelve a pagar');

  -- venta en masa: vista previa
  r := public.sell_duplicates_bulk(array['C'], false, false, null);
  perform t.ok(not (r ->> 'confirmed')::boolean, 'sin confirmar solo se calcula');
  perform t.ok((r ->> 'cards')::integer = 2 and (r ->> 'copies')::integer = 8 and (r ->> 'coins')::numeric = 480,
               'vista previa: 2 cartas, 8 copias, 480 monedas');
  select sum(copies) into v_n from public.player_cards where user_id = v_dave and card_id in ('OP01-C011', 'OP01-C012');
  perform t.ok(v_n = 10, 'la vista previa NO vende nada');

  select coins into v_antes from public.player_economy where user_id = v_dave;
  perform t.fails($q$select public.sell_duplicates_bulk(array['C'], false, true, 1)$q$, 'state_changed', 'si las monedas que viste no coinciden, no se vende');
  perform t.ok((select sum(copies) from public.player_cards where user_id = v_dave and card_id in ('OP01-C011', 'OP01-C012')) = 10, 'y no se vendió nada');
  r := public.sell_duplicates_bulk(array['C'], false, true, 480);
  perform t.ok((r ->> 'confirmed')::boolean and (r ->> 'coins')::numeric = 480, 'confirmando con el importe correcto se vende');
  perform t.ok((r ->> 'coins_total')::numeric = v_antes + 480, 'el saldo sube EXACTAMENTE 480');
  perform t.ok(not exists (select 1 from public.player_cards where user_id = v_dave and card_id in ('OP01-C011', 'OP01-C012') and copies <> 1),
               'queda 1 copia de cada carta');

  -- variantes valiosas: protegidas salvo que se pida
  r := public.sell_duplicates_bulk(array['SR'], false, false, null);
  perform t.ok((r ->> 'copies')::integer = 0, 'por defecto NO se venden las cartas de arte alternativo');
  perform t.fails($q$select public.sell_duplicates_bulk(array['SR'], false, true, null)$q$, 'no_duplicates', 'confirmar sin nada que vender da error');
  r := public.sell_duplicates_bulk(array['SR'], true, false, null);
  perform t.ok((r ->> 'cards')::integer = 1 and (r ->> 'copies')::integer = 4 and (r ->> 'coins')::numeric = 12000,
               'incluyendo variantes: 4 copias del arte alternativo a 3000 cada una');

  perform t.fails($q$select public.sell_duplicates_bulk(array[]::text[], false, false, null)$q$, 'invalid_quantity', 'sin elegir ninguna rareza da error');
  perform t.fails($q$select public.sell_duplicates_bulk(array['C','UC','R','L','SR','SEC','TR','PR','P','DON','X','Y','Z'], false, false, null)$q$,
                  'invalid_quantity', 'una lista de rarezas demasiado larga da error');
end;
$$;
