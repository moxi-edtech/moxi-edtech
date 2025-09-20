-- apps/web/supabase/migrations/20250917_add_plano_to_escolas.sql

alter table public.escolas
  add column if not exists plano text not null default 'basico'
  check (plano in ('basico','standard','premium'));

comment on column public.escolas.plano is 'Plano da escola: basico | standard | premium';

-- Update view to use the real column instead of constant
create or replace view public.escolas_view as
select
  e.id,
  e.nome,
  e.status,
  e.plano as plano,
  null::timestamp as last_access,
  coalesce(a.total_alunos, 0) as total_alunos,
  coalesce(pf.total_professores, 0) as total_professores,
  e.endereco as cidade,
  null::text as estado
from public.escolas e
left join (
  select escola_id, count(*)::int as total_alunos
  from public.alunos
  group by escola_id
) a on a.escola_id = e.id
left join (
  select p.escola_id, count(*)::int as total_professores
  from public.profiles p
  where p.role = 'professor'
  group by p.escola_id
) pf on pf.escola_id = e.id;

notify pgrst, 'reload schema';

