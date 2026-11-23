-- ¿LAS CARTAS MÁS RARAS SALEN MENOS? Se abren 3000 sobres y se mide cuántas veces sale cada cosa.
-- Los márgenes son amplios (más de 4 desviaciones típicas) para que la prueba no falle por azar.
create or replace view t.huecos_alice as
select h.id as paquete,
       e.ord as hueco,
       case when coalesce((c.meta ->> 'manga')::boolean, false) then 'MANGA'
            when coalesce((c.meta ->> 'sp')::boolean, false) then 'SP'
            when coalesce((c.meta ->> 'alt')::boolean, false) then 'ALT'
            else c.rarity end as nivel
from public.pack_history h
cross join lateral jsonb_array_elements(h.cards) with ordinality as e(val, ord)
join public.catalog_cards c on c.card_id = (e.val ->> 'card_id')
where h.product_id = 'OP01'
  and h.user_id = (select id from public.profiles where username_lower = 'alice');

do $$
declare
  v_alice uuid := t.login('alice');
  i integer;
  v_prod numeric;
  v_suma numeric;
  n_r integer; n_sr integer; n_l integer; n_alt integer; n_sec integer; n_sp integer; n_manga integer;
  n_c integer; n_uc45 integer; n_otros integer;
begin
  update public.player_packs set quantity = 3000 where user_id = v_alice and product_id = 'OP01';
  delete from public.pack_history where user_id = v_alice;

  for i in 1..3000 loop
    delete from public.rate_limits; -- no queremos que el límite de frecuencia frene la prueba
    perform public.open_pack('OP01', gen_random_uuid());
  end loop;

  perform t.ok((select count(distinct paquete) from t.huecos_alice) = 3000, 'se abrieron 3000 sobres');
  perform t.ok((select count(*) from t.huecos_alice) = 18000, 'cada sobre trae 6 cartas');
  perform t.ok(not exists (select 1 from public.player_packs where user_id = v_alice and product_id = 'OP01'), 'se gastaron los 3000 sobres');

  -- Huecos 1-3: comunes (85%) y poco comunes (15%)
  select count(*) into n_c from t.huecos_alice where hueco <= 3 and nivel = 'C';
  select count(*) into n_otros from t.huecos_alice where hueco <= 5 and nivel not in ('C', 'UC');
  perform t.ok(n_c between 7380 and 7920, 'huecos 1-3: unas 85% comunes (' || n_c || ' de 9000)');
  perform t.ok(n_otros = 0, 'los huecos 1-5 NUNCA dan una carta rara');
  select count(*) into n_uc45 from t.huecos_alice where hueco in (4, 5) and nivel = 'UC';
  perform t.ok(n_uc45 = 6000, 'los huecos 4 y 5 son SIEMPRE poco comunes');

  -- Hueco 6 (el premio)
  select count(*) filter (where nivel = 'R'), count(*) filter (where nivel = 'SR'), count(*) filter (where nivel = 'L'),
         count(*) filter (where nivel = 'ALT'), count(*) filter (where nivel = 'SEC'), count(*) filter (where nivel = 'SP'),
         count(*) filter (where nivel = 'MANGA')
    into n_r, n_sr, n_l, n_alt, n_sec, n_sp, n_manga
    from t.huecos_alice where hueco = 6;
  perform t.ok(n_r between 1740 and 1980, 'premio: unas 62% Raras (' || n_r || ' de 3000)');
  perform t.ok(n_sr between 420 and 660, 'premio: unas 18% Super Raras (' || n_sr || ')');
  perform t.ok(n_l between 105 and 255, 'premio: unas 6% Leader (' || n_l || ')');
  perform t.ok(n_alt between 150 and 330, 'premio: unas 8% de arte alternativo (' || n_alt || ')');
  perform t.ok(n_sec between 30 and 150, 'premio: unas 3% Secret Rare (' || n_sec || ')');
  perform t.ok(n_sp between 15 and 105, 'premio: unas 2% SP (' || n_sp || ')');
  perform t.ok(n_manga between 5 and 90, 'premio: unas 1% Manga (' || n_manga || ')');
  perform t.ok(n_r + n_sr + n_l + n_alt + n_sec + n_sp + n_manga = 3000, 'el premio siempre es de uno de esos niveles');
  perform t.ok(n_r > n_sr and n_sr > n_sec and n_sec > n_manga, 'LO MÁS RARO SALE MENOS: Rara > Super Rara > Secret Rare > Manga');

  select production_per_sec into v_prod from public.player_economy where user_id = v_alice;
  select coalesce(sum(production_per_sec), 0) into v_suma from public.player_cards where user_id = v_alice;
  perform t.ok(abs(v_prod - v_suma) < 0.01, 'tras 3000 aperturas la producción total sigue coincidiendo con la suma de las cartas');
  perform t.ok((select packs_opened from public.player_progress where user_id = v_alice) >= 3000, 'el contador de sobres abiertos es coherente');
end;
$$;
drop view t.huecos_alice;
