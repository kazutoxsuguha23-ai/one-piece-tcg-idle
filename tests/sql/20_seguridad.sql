-- PERMISOS Y RLS: qué puede (y qué NO puede) hacer cada tipo de usuario.

-- A) Estructura de la base de datos
do $$
declare
  v_n integer;
  v_esperadas text[] := array['admin_give_card','admin_give_coins','admin_give_pack','admin_list_users','admin_recalc_all',
    'admin_reset_user','admin_set_card_level','admin_set_coins','admin_sync_products','bootstrap_session','buy_pack','buy_upgrade',
    'card_upgrade_info','collect_all','collect_card','is_admin','list_upgrades','open_pack','sell_card_duplicates',
    'sell_duplicates_bulk','upgrade_card'];
  v_reales text[];
  v_lista text;
begin
  select count(*) into v_n from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  perform t.ok(v_n = 0, 'TODAS las tablas de public tienen RLS activado');

  select count(*) into v_n from pg_policies where schemaname = 'public' and cmd <> 'SELECT';
  perform t.ok(v_n = 0, 'no existe ninguna política de escritura (insert/update/delete)');

  select count(*) into v_n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c where c like 'search_path=%');
  perform t.ok(v_n = 0, 'toda función SECURITY DEFINER fija search_path');

  select count(*) into v_n from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and (has_table_privilege('anon', c.oid, 'insert,update,delete,truncate')
       or has_table_privilege('authenticated', c.oid, 'insert,update,delete,truncate'));
  perform t.ok(v_n = 0, 'ni anon ni authenticated pueden escribir directamente en NINGUNA tabla');

  select string_agg(c.relname::text, ',' order by c.relname::text) into v_lista from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege('anon', c.oid, 'select');
  perform t.ok(v_lista = 'game_config', 'anon solo puede leer game_config (y solo lo público): ' || coalesce(v_lista, '-'));

  select coalesce(array_agg(p.proname::text order by p.proname::text collate "C"), '{}'::text[]) into v_reales
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute');
  perform t.ok(v_reales = (select array_agg(x order by x collate "C") from unnest(v_esperadas) x),
               'las únicas funciones ejecutables por un jugador son las previstas: ' || array_to_string(v_reales, ','));

  select count(*) into v_n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute');
  perform t.ok(v_n = 0, 'un usuario sin sesión (anon) no puede ejecutar NINGUNA función');
end;
$$;

-- B) Usuario SIN sesión (anon)
select t.logout();
set role anon;
select t.fails($q$select * from public.player_economy$q$, 'permission denied', 'anon no puede leer economías');
select t.fails($q$select * from public.profiles$q$, 'permission denied', 'anon no puede leer perfiles');
select t.fails($q$select * from public.catalog_cards$q$, 'permission denied', 'anon no puede leer el catálogo');
select t.fails($q$select public.collect_all()$q$, 'permission denied', 'anon no puede cobrar');
select t.fails($q$select public.buy_pack('OP01', 1, gen_random_uuid())$q$, 'permission denied', 'anon no puede comprar');
select t.ok((select count(*) from public.game_config where key = 'invite_code') = 0, 'anon NO ve el código de invitación');
select t.ok((select count(*) from public.game_config where key = 'registration_open') = 1, 'anon sí ve si el registro está abierto');
reset role;

-- C) Un jugador normal (alice)
select t.login('alice');
set role authenticated;
select t.ok((select count(*) from public.player_economy) = 1, 'alice solo ve SU fila de economía');
select t.ok((select count(*) from public.profiles) = 1, 'alice solo ve SU perfil');
select t.ok((select count(*) from public.player_progress) = 1, 'alice solo ve SU progreso');
select t.ok((select count(*) from public.admin_log) = 0, 'alice no ve el registro de administración');
select t.ok((select count(*) from public.catalog_cards) > 100, 'alice sí puede leer el catálogo');
select t.fails($q$update public.player_economy set coins = 99999999$q$, 'permission denied', 'alice NO puede cambiarse el saldo');
select t.fails($q$update public.profiles set role = 'admin'$q$, 'permission denied', 'alice NO puede hacerse administradora');
select t.fails($q$insert into public.player_cards (user_id, card_id, copies) values (auth.uid(), 'OP01-C001', 5)$q$, 'permission denied', 'alice NO puede inventarse cartas');
select t.fails($q$insert into public.player_packs (user_id, product_id, quantity) values (auth.uid(), 'OP01', 99)$q$, 'permission denied', 'alice NO puede inventarse sobres');
select t.fails($q$delete from public.pack_history$q$, 'permission denied', 'alice NO puede borrar el historial');
select t.fails($q$update public.game_config set value = 'false'::jsonb where key = 'registration_open'$q$, 'permission denied', 'alice NO puede cambiar la configuración');
select t.fails($q$update public.pack_products set price = 0$q$, 'permission denied', 'alice NO puede cambiar los precios');
select t.fails($q$select public.settle_player(auth.uid())$q$, 'permission denied', 'función interna settle_player: sin acceso');
select t.fails($q$select public.calc_card_production('OP01-C001', 1, 1)$q$, 'permission denied', 'función interna calc_card_production: sin acceso');
select t.fails($q$select public.consume_rate_limit('x', 1, 1)$q$, 'permission denied', 'función interna consume_rate_limit: sin acceso');
select t.fails($q$select public.enforce_rate_limit('x', 1, 1)$q$, 'permission denied', 'función interna enforce_rate_limit: sin acceso');
select t.fails($q$select public.pick_weighted('{"a":1}'::jsonb)$q$, 'permission denied', 'función interna pick_weighted: sin acceso');
select t.fails($q$select public.sync_pack_products()$q$, 'permission denied', 'función interna sync_pack_products: sin acceso');
select t.fails($q$select public.admin_give_coins('alice', 1000)$q$, 'forbidden', 'un jugador NO puede usar admin_give_coins');
select t.fails($q$select public.admin_set_coins('alice', 1000)$q$, 'forbidden', 'un jugador NO puede usar admin_set_coins');
select t.fails($q$select public.admin_give_pack('alice', 'OP01', 5)$q$, 'forbidden', 'un jugador NO puede usar admin_give_pack');
select t.fails($q$select public.admin_give_card('alice', 'OP01-C001', 5)$q$, 'forbidden', 'un jugador NO puede usar admin_give_card');
select t.fails($q$select public.admin_set_card_level('alice', 'OP01-C001', 50)$q$, 'forbidden', 'un jugador NO puede usar admin_set_card_level');
select t.fails($q$select public.admin_reset_user('bob')$q$, 'forbidden', 'un jugador NO puede resetear a otro');
select t.fails($q$select public.admin_recalc_all()$q$, 'forbidden', 'un jugador NO puede recalcular a todos');
select t.fails($q$select * from public.admin_list_users('')$q$, 'forbidden', 'un jugador NO puede listar usuarios');
select t.fails($q$select public.admin_sync_products()$q$, 'forbidden', 'un jugador NO puede sincronizar productos');
reset role;

-- D) El administrador
select t.login('admin1');
set role authenticated;
select t.ok((select count(*) from public.player_economy) = 6, 'el admin sí ve las 6 economías');
select t.ok((select count(*) from public.profiles) = 6, 'el admin sí ve los 6 perfiles');
select t.ok(public.is_admin(), 'is_admin() es verdadero para el admin');
select t.fails($q$update public.player_economy set coins = 1$q$, 'permission denied', 'ni siquiera el admin escribe directamente en las tablas (solo por funciones)');
reset role;

select t.login('alice');
set role authenticated;
select t.ok(not public.is_admin(), 'is_admin() es falso para un jugador');
reset role;

-- E) Los objetos FUTUROS nacen cerrados (endurecimiento de permisos por defecto)
create table public.zz_prueba (id integer);
create function public.zz_funcion() returns integer language sql as $$ select 1 $$;
select t.ok(not has_table_privilege('authenticated', 'public.zz_prueba', 'select'), 'una tabla NUEVA no es accesible por defecto para jugadores');
select t.ok(not has_table_privilege('anon', 'public.zz_prueba', 'select'), 'una tabla NUEVA no es accesible por defecto sin sesión');
select t.ok(not has_function_privilege('anon', 'public.zz_funcion()', 'execute'), 'una función NUEVA no es ejecutable por defecto sin sesión');
select t.ok(not has_function_privilege('authenticated', 'public.zz_funcion()', 'execute'), 'una función NUEVA no es ejecutable por defecto por jugadores');
drop function public.zz_funcion();
drop table public.zz_prueba;
