-- Alta de cuentas: el disparador crea perfil, economía y progreso, y valida el nombre.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@opidle.app',  '{"username":"Alice"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@opidle.app',    '{"username":"bob"}'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin1@opidle.app', '{"username":"admin1"}'),
  ('00000000-0000-0000-0000-0000000000c3', 'carol@opidle.app',  '{"username":"carol"}'),
  ('00000000-0000-0000-0000-0000000000d4', 'dave@opidle.app',   '{"username":"dave"}'),
  ('00000000-0000-0000-0000-0000000000e5', 'erin@opidle.app',   '{"username":"erin"}');
update public.profiles set role = 'admin' where username_lower = 'admin1';

select t.ok((select count(*) from public.profiles) = 6, 'se crean los 6 perfiles');
select t.ok((select count(*) from public.player_economy) = 6, 'se crean las 6 economías');
select t.ok((select count(*) from public.player_progress) = 6, 'se crean los 6 progresos');
select t.ok((select e.coins from public.player_economy e join public.profiles p on p.id = e.user_id where p.username_lower = 'alice') = 500,
            'cada cuenta nueva empieza con 500 monedas');
select t.ok((select role from public.profiles where username_lower = 'alice') = 'player', 'las cuentas nuevas son jugadores, no admin');
select t.ok((select username from public.profiles where username_lower = 'alice') = 'Alice', 'se conserva cómo escribió el nombre');

select t.fails($q$insert into auth.users (email, raw_user_meta_data) values ('x@opidle.app', '{"username":"a"}')$q$,
               'invalid_username', 'rechaza un usuario demasiado corto');
select t.fails($q$insert into auth.users (email, raw_user_meta_data) values ('x@opidle.app', '{"username":"con espacio"}')$q$,
               'invalid_username', 'rechaza caracteres no permitidos');
select t.fails($q$insert into auth.users (email, raw_user_meta_data) values ('x@opidle.app', '{"username":"muy_largo_muy_largo_21"}')$q$,
               'invalid_username', 'rechaza un usuario de más de 20 caracteres');
select t.fails($q$insert into auth.users (email, raw_user_meta_data) values ('x@opidle.app', '{}')$q$,
               'invalid_username', 'rechaza una cuenta sin nombre de usuario');
select t.fails($q$insert into auth.users (email, raw_user_meta_data) values ('y@opidle.app', '{"username":"ALICE"}')$q$,
               'duplicate key', 'rechaza un nombre repetido aunque cambien las mayúsculas');
select t.ok((select count(*) from public.profiles) = 6, 'los intentos rechazados no dejaron cuentas a medias');

-- El saldo inicial sale de la configuración
update public.game_config set value = '1000'::jsonb where key = 'starting_coins';
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f6', 'frank@opidle.app', '{"username":"frank"}');
select t.ok((select coins from public.player_economy where user_id = '00000000-0000-0000-0000-0000000000f6') = 1000,
            'el saldo inicial se puede cambiar en game_config');
update public.game_config set value = '500'::jsonb where key = 'starting_coins';
delete from auth.users where id = '00000000-0000-0000-0000-0000000000f6';
select t.ok((select count(*) from public.profiles) = 6, 'al borrar un usuario se borran sus datos (cascada)');
