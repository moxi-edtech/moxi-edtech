-- KLASSE: backfill classes.ano_letivo_id from turmas
update public.classes c
set ano_letivo_id = t.ano_letivo_id
from (
  select distinct on (classe_id)
    classe_id,
    ano_letivo_id
  from public.turmas
  where ano_letivo_id is not null
  order by classe_id, created_at desc
) t
where c.id = t.classe_id
  and c.ano_letivo_id is null;
