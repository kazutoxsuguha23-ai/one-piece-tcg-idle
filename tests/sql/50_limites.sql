-- LÍMITES DE FRECUENCIA POR JUGADOR (antiabuso)
do $$
declare
  v_alice uuid := t.login('alice');
  i integer;
begin
  delete from public.rate_limits;
  for i in 1..3 loop
    perform public.enforce_rate_limit('prueba', 3, 60);
  end loop;
  perform t.fails($q$select public.enforce_rate_limit('prueba', 3, 60)$q$, 'rate_limited', 'la 4.ª acción en la misma ventana se rechaza');

  perform t.login('bob');
  perform public.enforce_rate_limit('prueba', 3, 60);
  perform t.ok(true, 'el límite es POR jugador: bob no se ve afectado');

  perform t.login('alice');
  update public.rate_limits set window_start = now() - interval '2 minutes' where key like 'fn:prueba:%';
  perform public.enforce_rate_limit('prueba', 3, 60);
  perform t.ok(true, 'al terminar la ventana de tiempo se vuelve a permitir');

  perform t.logout();
  perform t.fails($q$select public.enforce_rate_limit('prueba', 3, 60)$q$, 'not_authenticated', 'sin sesión no hay límite que aplicar: se rechaza');

  -- Una función real del juego
  perform t.login('alice');
  update public.player_economy set coins = 100000000 where user_id = v_alice;
  delete from public.rate_limits;
  for i in 1..60 loop
    perform public.buy_pack('OP01', 1, gen_random_uuid());
  end loop;
  perform t.fails($q$select public.buy_pack('OP01', 1, gen_random_uuid())$q$, 'rate_limited', 'comprar sobres se limita a 60 por minuto');
  delete from public.rate_limits;
end;
$$;
