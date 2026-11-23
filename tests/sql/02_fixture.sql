-- Catálogo pequeño pero completo: todas las rarezas y variantes que usan los sobres.
insert into public.catalog_sets (set_id, name, kind) values
  ('OP01',  'Romance Dawn (prueba)', 'booster'),
  ('OP02',  'Set SIN cartas (prueba)', 'booster'),
  ('EB01',  'Extra (prueba)', 'extra_booster'),
  ('PRB01', 'Premium (prueba)', 'premium_booster'),
  ('ST01',  'Starter (prueba)', 'starter_deck'),
  ('PROMO', 'Promos', 'promo'),
  ('DON',   'DON!!', 'don');

-- OP01 base: 40 C, 30 UC, 20 R, 10 SR, 4 L, 4 SEC
insert into public.catalog_cards (card_id, set_id, code, name, rarity, card_type, variant, meta)
select 'OP01-C' || lpad(i::text, 3, '0'), 'OP01', 'OP01-C' || lpad(i::text, 3, '0'), 'Común ' || i, 'C', 'character', 'base', '{}'::jsonb
from generate_series(1, 40) i;
insert into public.catalog_cards (card_id, set_id, code, name, rarity, card_type, variant, meta)
select 'OP01-U' || lpad(i::text, 3, '0'), 'OP01', 'OP01-U' || lpad(i::text, 3, '0'), 'Poco común ' || i, 'UC', 'character', 'base', '{}'::jsonb
from generate_series(1, 30) i;
insert into public.catalog_cards (card_id, set_id, code, name, rarity, card_type, variant, meta)
select 'OP01-R' || lpad(i::text, 3, '0'), 'OP01', 'OP01-R' || lpad(i::text, 3, '0'), 'Rara ' || i, 'R', 'character', 'base', '{}'::jsonb
from generate_series(1, 20) i;
insert into public.catalog_cards (card_id, set_id, code, name, rarity, card_type, variant, meta)
select 'OP01-S' || lpad(i::text, 3, '0'), 'OP01', 'OP01-S' || lpad(i::text, 3, '0'), 'Super rara ' || i, 'SR', 'character', 'base', '{}'::jsonb
from generate_series(1, 10) i;
insert into public.catalog_cards (card_id, set_id, code, name, rarity, card_type, variant, meta)
select 'OP01-L' || lpad(i::text, 3, '0'), 'OP01', 'OP01-L' || lpad(i::text, 3, '0'), 'Leader ' || i, 'L', 'leader', 'base', '{}'::jsonb
from generate_series(1, 4) i;
insert into public.catalog_cards (card_id, set_id, code, name, rarity, card_type, variant, meta)
select 'OP01-E' || lpad(i::text, 3, '0'), 'OP01', 'OP01-E' || lpad(i::text, 3, '0'), 'Secreta ' || i, 'SEC', 'character', 'base', '{}'::jsonb
from generate_series(1, 4) i;

-- Variantes: 6 de arte alternativo (SR), 3 SP (SR), 2 Manga (SEC)
insert into public.catalog_cards (card_id, set_id, code, name, rarity, card_type, variant, meta)
select 'OP01-A' || lpad(i::text, 3, '0') || '_p1', 'OP01', 'OP01-A' || lpad(i::text, 3, '0'), 'Alt ' || i, 'SR', 'character', 'p1',
       '{"alt": true}'::jsonb
from generate_series(1, 6) i;
insert into public.catalog_cards (card_id, set_id, code, name, rarity, card_type, variant, meta)
select 'OP01-P' || lpad(i::text, 3, '0') || '_p1', 'OP01', 'OP01-P' || lpad(i::text, 3, '0'), 'SP ' || i, 'SR', 'character', 'p1',
       '{"alt": true, "sp": true}'::jsonb
from generate_series(1, 3) i;
insert into public.catalog_cards (card_id, set_id, code, name, rarity, card_type, variant, meta)
select 'OP01-M' || lpad(i::text, 3, '0') || '_p2', 'OP01', 'OP01-M' || lpad(i::text, 3, '0'), 'Manga ' || i, 'SEC', 'character', 'p2',
       '{"alt": true, "manga": true}'::jsonb
from generate_series(1, 2) i;

-- Starter deck: 10 cartas base + 2 de arte alternativo (que NO deben salir en el mazo)
insert into public.catalog_cards (card_id, set_id, code, name, rarity, card_type, variant, meta)
select 'ST01-' || lpad(i::text, 3, '0'), 'ST01', 'ST01-' || lpad(i::text, 3, '0'), 'Starter ' || i,
       case when i <= 6 then 'C' else 'R' end, 'character', 'base', '{}'::jsonb
from generate_series(1, 10) i;
insert into public.catalog_cards (card_id, set_id, code, name, rarity, card_type, variant, meta)
select 'ST01-A' || i || '_p1', 'ST01', 'ST01-00' || i, 'Starter alt ' || i, 'R', 'character', 'p1', '{"alt": true}'::jsonb
from generate_series(1, 2) i;

-- Premium: 6 C, 4 UC, 3 R, 2 SR
insert into public.catalog_cards (card_id, set_id, code, name, rarity, card_type, variant, meta)
select 'PRB01-' || lpad(i::text, 3, '0'), 'PRB01', 'PRB01-' || lpad(i::text, 3, '0'), 'Premium ' || i,
       case when i <= 6 then 'C' when i <= 10 then 'UC' when i <= 13 then 'R' else 'SR' end, 'character', 'base', '{}'::jsonb
from generate_series(1, 15) i;

-- Estas dos NUNCA deben salir en un sobre (DON!! y promo)
insert into public.catalog_cards (card_id, set_id, code, name, rarity, card_type, variant, meta) values
  ('DON-001', 'DON', 'DON-001', 'DON!! Card', 'DON', 'don', 'base', '{}'::jsonb),
  ('PROMO-001', 'PROMO', 'P-001', 'Promo', 'PR', 'character', 'base', '{}'::jsonb);
