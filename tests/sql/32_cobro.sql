-- COBRAR LA PRODUCCIÓN (todo el bloque va en una transacción: now() es fijo, así las cuentas son exactas)
do $$
declare
  v_alice uuid := t.login('alice');
  v_prod numeric;
  v_n integer;
  r jsonb;
  v_ganado numeric;
  v_antes numeric;
begin
  perform public.collect_all();
  select production_per_sec into v_prod from public.player_economy where user_id = v_alice;
  select count(*) into v_n from public.player_cards where user_id = v_alice;
  perform t.ok(v_prod > 0 and v_n > 50, 'alice tiene muchas cartas y produce monedas');

  -- 1 hora
  update public.player_cards set last_collected_at = now() - interval '1 hour' where user_id = v_alice;
  select coins into v_antes from public.player_economy where user_id = v_alice;
  r := public.collect_all();
  v_ganado := (r ->> 'collected')::numeric;
  perform t.ok(abs(v_ganado - v_prod * 3600) <= v_n + 1, 'tras 1 hora cobra ~ producción x 3600 (' || v_ganado || ')');
  perform t.ok((r ->> 'coins')::numeric = v_antes + v_ganado, 'el saldo sube EXACTAMENTE lo cobrado');

  -- límite de acumulación: 8 horas aunque pasen 20
  update public.player_cards set last_collected_at = now() - interval '20 hours' where user_id = v_alice;
  r := public.collect_all();
  v_ganado := (r ->> 'collected')::numeric;
  perform t.ok(abs(v_ganado - v_prod * 28800) <= v_n + 1, 'tras 20 h solo cobra 8 h (límite de acumulación) (' || v_ganado || ')');

  -- cobrar dos veces seguidas no da nada
  r := public.collect_all();
  perform t.ok((r ->> 'collected')::numeric <= v_n, 'cobrar otra vez enseguida no da monedas extra');

  -- cobrar una sola carta
  perform t.fails($q$select public.collect_card('OP01-C001-NOEXISTE')$q$, 'card_not_owned', 'no se puede cobrar una carta que no se tiene');
  update public.player_cards set last_collected_at = now() - interval '1 hour'
   where user_id = v_alice and card_id = (select card_id from public.player_cards where user_id = v_alice order by production_per_sec desc limit 1);
  r := public.collect_card((select card_id from public.player_cards where user_id = v_alice order by production_per_sec desc limit 1));
  perform t.ok((r ->> 'collected')::numeric > 0, 'cobrar una carta concreta paga su producción');

  -- el reloj es el del servidor: una fecha futura no paga nada
  update public.player_cards set last_collected_at = now() + interval '5 hours' where user_id = v_alice;
  r := public.collect_all();
  perform t.ok((r ->> 'collected')::numeric = 0, 'una marca de tiempo en el futuro no genera monedas');
end;
$$;
