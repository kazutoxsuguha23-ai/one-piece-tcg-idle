-- SUBIR DE NIVEL (carol). El bloque va en una transacción: now() es fijo y los cobros son exactos.
do $$
declare
  v_carol uuid;
  i jsonb;
  r jsonb;
  v_antes numeric;
  v_despues numeric;
  v_copias integer;
  v_nivel integer;
  v_plan_monedas numeric;
  v_plan_copias integer;
  v_prod numeric;
  v_suma numeric;
begin
  perform t.login('admin1');
  select id into v_carol from public.profiles where username_lower = 'carol';
  perform public.admin_give_card('carol', 'OP01-C001', 10);
  perform public.admin_give_card('carol', 'OP01-C002', 1);
  update public.player_economy set coins = 10000000 where user_id = v_carol;
  perform t.login('carol');

  i := public.card_upgrade_info('OP01-C001');
  perform t.ok((i ->> 'level')::integer = 1 and (i ->> 'spendable')::integer = 9, 'con 10 copias hay 9 repetidas: la primera está protegida');
  perform t.ok((i -> 'next_cost' ->> 'copies')::integer = 1 and (i -> 'next_cost' ->> 'coins')::numeric = 120,
               'subir del nivel 1 al 2 cuesta 1 copia y 120 monedas');
  perform t.ok((i ->> 'max_levels')::integer = 9, 'con 9 repetidas puede subir 9 niveles seguidos');
  perform t.ok(jsonb_array_length(i -> 'plan') = 9, 'el plan tiene un paso por nivel posible');
  perform t.ok((i ->> 'sell_each')::numeric = 60, 'cada copia repetida de una Común se vende por 60');
  perform t.ok((i ->> 'production_next')::numeric > (i ->> 'production_now')::numeric, 'subir de nivel aumenta la producción');

  perform t.fails($q$select public.upgrade_card('OP01-C002', 1, 1)$q$, 'insufficient_copies', 'LA PRIMERA COPIA NO SE PUEDE GASTAR');
  perform t.fails($q$select public.upgrade_card('OP01-C001', 2, 1)$q$, 'state_changed', 'si el nivel no es el que viste, se rechaza');
  perform t.fails($q$select public.upgrade_card('OP01-C001', 1, 100)$q$, 'max_level', 'no se puede pasar del nivel máximo');
  perform t.fails($q$select public.upgrade_card('OP01-C001', 1, 0)$q$, 'invalid_quantity', 'subir 0 niveles da error');
  perform t.fails($q$select public.upgrade_card('OP01-C001', 1, -3)$q$, 'invalid_quantity', 'subir niveles negativos da error');
  perform t.fails($q$select public.upgrade_card('OP01-U001', 1, 1)$q$, 'card_not_owned', 'no se puede mejorar una carta que no se tiene');
  perform t.fails($q$select public.card_upgrade_info('OP01-U001')$q$, 'card_not_owned', 'tampoco se puede consultar');

  -- subir un nivel
  select coins into v_antes from public.player_economy where user_id = v_carol;
  r := public.upgrade_card('OP01-C001', 1, 1);
  select coins into v_despues from public.player_economy where user_id = v_carol;
  perform t.ok((r ->> 'level')::integer = 2 and (r ->> 'copies')::integer = 9, 'sube al nivel 2 y se gasta 1 copia');
  perform t.ok((r ->> 'spent_coins')::numeric = 120 and (r ->> 'spent_copies')::integer = 1, 'gasta 120 monedas y 1 copia');
  perform t.ok(v_despues >= v_antes - 120 and v_despues <= v_antes - 120 + 5, 'las monedas bajan en 120 (más una producción mínima ya acumulada)');
  perform t.ok((r ->> 'production_per_sec')::numeric = public.calc_card_production('OP01-C001', 2, 1), 'la producción nueva es la que dice la fórmula');
  select production_per_sec into v_prod from public.player_economy where user_id = v_carol;
  select coalesce(sum(production_per_sec), 0) into v_suma from public.player_cards where user_id = v_carol;
  perform t.ok(abs(v_prod - v_suma) < 0.001, 'la producción total sigue coincidiendo con la suma de las cartas');

  -- doble envío: el mismo "desde el nivel 1" ya no vale y NO cobra
  select coins into v_antes from public.player_economy where user_id = v_carol;
  perform t.fails($q$select public.upgrade_card('OP01-C001', 1, 1)$q$, 'state_changed', 'un DOBLE ENVÍO se rechaza');
  perform t.ok((select coins from public.player_economy where user_id = v_carol) = v_antes, 'y no se cobra nada por él');

  -- subir varios niveles: el coste real coincide con el plan que se le mostró
  i := public.card_upgrade_info('OP01-C001');
  v_plan_monedas := (i -> 'plan' -> 4 ->> 'coins')::numeric;
  v_plan_copias := (i -> 'plan' -> 4 ->> 'copies')::integer;
  r := public.upgrade_card('OP01-C001', 2, 5);
  perform t.ok((r ->> 'spent_coins')::numeric = v_plan_monedas and (r ->> 'spent_copies')::integer = v_plan_copias,
               'subir 5 niveles cuesta exactamente lo que enseñaba el plan');
  perform t.ok((r ->> 'level')::integer = 7, 'queda en nivel 7');

  -- sin monedas suficientes: no se pierde NADA (atómico)
  update public.player_economy set coins = 10 where user_id = v_carol;
  select copies, level into v_copias, v_nivel from public.player_cards where user_id = v_carol and card_id = 'OP01-C001';
  perform t.fails($q$select public.upgrade_card('OP01-C001', 7, 1)$q$, 'insufficient_funds', 'sin monedas suficientes no se sube de nivel');
  perform t.ok((select copies from public.player_cards where user_id = v_carol and card_id = 'OP01-C001') = v_copias
               and (select level from public.player_cards where user_id = v_carol and card_id = 'OP01-C001') = v_nivel,
               'si falla, la carta queda EXACTAMENTE igual (operación atómica)');
  perform t.ok((select coins from public.player_economy where user_id = v_carol) = 10, 'y las monedas también');

  -- nivel máximo
  perform t.login('admin1');
  perform public.admin_set_card_level('carol', 'OP01-C001', 100);
  perform t.login('carol');
  update public.player_economy set coins = 10000000 where user_id = v_carol;
  perform t.fails($q$select public.upgrade_card('OP01-C001', 100, 1)$q$, 'max_level', 'en el nivel 100 no se puede subir más');
  i := public.card_upgrade_info('OP01-C001');
  perform t.ok(jsonb_typeof(i -> 'next_cost') = 'null', 'en el nivel máximo no hay "siguiente coste"');

  -- hitos: cada 25 niveles la producción se duplica
  perform t.ok(public.calc_card_production('OP01-C001', 25, 1) / public.calc_card_production('OP01-C001', 24, 1) between 2.0 and 2.1,
               'en el nivel 25 la producción se duplica (hito)');

  -- fracciones de moneda: cobrar muy a menudo no hace perder nada
  update public.player_cards set last_collected_at = now() - interval '3 seconds' where user_id = v_carol and card_id = 'OP01-C002';
  r := public.collect_card('OP01-C002');
  perform t.ok((r ->> 'collected')::numeric = 0, 'a los 3 s una carta de 0,2/s aún no paga ni 1 moneda');
  perform t.ok((select last_collected_at from public.player_cards where user_id = v_carol and card_id = 'OP01-C002') < now() - interval '2 seconds',
               'y NO pierde la fracción acumulada');
  update public.player_cards set last_collected_at = now() - interval '7 seconds' where user_id = v_carol and card_id = 'OP01-C002';
  r := public.collect_card('OP01-C002');
  perform t.ok((r ->> 'collected')::numeric = 1, 'a los 7 s paga 1 moneda');
  perform t.ok(abs(extract(epoch from (now() - (select last_collected_at from public.player_cards where user_id = v_carol and card_id = 'OP01-C002'))) - 2) < 0.01,
               'y conserva los 2 s sobrantes para la siguiente');
end;
$$;
