-- MEJORAS DE LA CUENTA (erin)
do $$
declare
  v_erin uuid;
  r jsonb;
  v_prod numeric;
  v_suma numeric;
begin
  perform t.login('admin1');
  select id into v_erin from public.profiles where username_lower = 'erin';
  perform public.admin_give_card('erin', 'OP01-C003', 1);
  update public.player_economy set coins = 10000000 where user_id = v_erin;
  perform t.login('erin');

  r := public.list_upgrades();
  perform t.ok(jsonb_array_length(r) = 2, 'hay 2 mejoras globales');
  perform t.ok(r -> 0 ->> 'id' = 'prod_mult' and (r -> 0 ->> 'level')::integer = 0 and (r -> 0 ->> 'next_cost')::numeric = 5000,
               'la 1.ª (producción) está en nivel 0 y cuesta 5000');

  perform t.fails($q$select public.buy_upgrade('prod_mult', 3)$q$, 'state_changed', 'con un nivel distinto al real, se rechaza');
  perform t.fails($q$select public.buy_upgrade('nada', 0)$q$, 'upgrade_not_found', 'una mejora inexistente da error');

  r := public.buy_upgrade('prod_mult', 0);
  perform t.ok((r ->> 'level')::integer = 1, 'se compra la mejora de producción (nivel 1)');
  perform t.ok((select (upgrades ->> 'prod_mult')::numeric from public.player_progress where user_id = v_erin) = 1.1, 'el multiplicador pasa a x1,1');
  perform t.ok(abs((select production_per_sec from public.player_cards where user_id = v_erin and card_id = 'OP01-C003') - 0.22) < 0.0001,
               'la producción de sus cartas sube un 10%');
  select production_per_sec into v_prod from public.player_economy where user_id = v_erin;
  select coalesce(sum(production_per_sec), 0) into v_suma from public.player_cards where user_id = v_erin;
  perform t.ok(abs(v_prod - v_suma) < 0.001, 'la producción total sigue siendo coherente');
  perform t.fails($q$select public.buy_upgrade('prod_mult', 0)$q$, 'state_changed', 'comprarla otra vez con el nivel viejo (doble clic) se rechaza');
  perform t.ok((select (upgrades -> 'levels' ->> 'prod_mult')::integer from public.player_progress where user_id = v_erin) = 1, 'y no se compró dos veces');

  r := public.buy_upgrade('storage', 0);
  perform t.ok(public.storage_cap_seconds(v_erin) = 28800 + 3600, 'el almacén ampliado suma 1 hora de capacidad');

  update public.player_progress set upgrades = jsonb_set(upgrades, '{levels,prod_mult}', '50'::jsonb) where user_id = v_erin;
  perform t.fails($q$select public.buy_upgrade('prod_mult', 50)$q$, 'max_level', 'en el nivel máximo no se puede comprar más');

  update public.player_economy set coins = 100 where user_id = v_erin;
  perform t.fails($q$select public.buy_upgrade('storage', 1)$q$, 'insufficient_funds', 'sin monedas suficientes no se compra');
  perform t.ok((select coins from public.player_economy where user_id = v_erin) = 100, 'y no se cobra nada');
  perform t.ok((select (upgrades -> 'levels' ->> 'storage')::integer from public.player_progress where user_id = v_erin) = 1, 'ni se cambia el nivel (atómico)');
end;
$$;
