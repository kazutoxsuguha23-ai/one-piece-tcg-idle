-- Pequeño sistema de pruebas: t.ok (afirmar), t.fails (esperar un error), t.login (entrar como un jugador)
create schema if not exists t;
grant usage on schema t to public;

create or replace function t.ok(p_cond boolean, p_msg text) returns void
language plpgsql as $$
begin
  if p_cond is distinct from true then
    raise exception 'FALLO: %', p_msg;
  end if;
  raise notice 'ok - %', p_msg;
end;
$$;

-- Ejecuta una instrucción y comprueba que da un error que contiene p_esperado
create or replace function t.fails(p_sql text, p_esperado text, p_msg text) returns void
language plpgsql as $$
declare
  v_err text;
begin
  begin
    execute p_sql;
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err is null then
    raise exception 'FALLO: % (no dio ningún error; se esperaba "%")', p_msg, p_esperado;
  end if;
  if position(p_esperado in v_err) = 0 then
    raise exception 'FALLO: % (el error fue "%" y no contiene "%")', p_msg, v_err, p_esperado;
  end if;
  raise notice 'ok - % [%]', p_msg, v_err;
end;
$$;

-- Entra como ese jugador (lo que auth.uid() devolverá). Llamar siendo superusuario.
create or replace function t.login(p_usuario text) returns uuid
language plpgsql as $$
declare
  v_id uuid;
begin
  select id into v_id from public.profiles where username_lower = lower(p_usuario);
  if v_id is null then
    raise exception 'FALLO: el usuario de prueba % no existe', p_usuario;
  end if;
  perform set_config('request.jwt.claim.sub', v_id::text, false);
  return v_id;
end;
$$;

create or replace function t.logout() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

-- Las migraciones cierran el permiso de ejecución por defecto, así que las funciones de ayuda
-- hay que abrirlas a propósito: las pruebas las llaman mientras se hacen pasar por anon / authenticated.
-- (Esto es solo del entorno de pruebas; no afecta a tu base de datos real.)
grant execute on all functions in schema t to public;
