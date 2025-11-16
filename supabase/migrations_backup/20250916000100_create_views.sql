-- Create view: escolas_view
-- Provides a consolidated list of schools with a few useful aggregates.
create or replace view public.escolas_view as
select
  e.id,
  e.nome,
  e.status,
  -- Placeholder for plan; adjust if you add a plans table/column later
  'Básico'::text as plano,
  -- Last access not tracked yet; null for now
  null::timestamp as last_access,
  -- Aggregate counts
  coalesce(a.total_alunos, 0) as total_alunos,
  coalesce(pf.total_professores, 0) as total_professores,
  -- Split address if you model city/state later; for now use endereco as city
  e.endereco as cidade,
  null::text as estado
from public.escolas e
left join (
  select escola_id, count(*)::int as total_alunos
  from public.alunos
  group by escola_id
) a on a.escola_id = e.id
left join (
  -- Professores table exists; count per school by joining turmas or profiles
  -- Prefer profiles with role='professor' if available
  select p.escola_id, count(*)::int as total_professores
  from public.profiles p
  where p.role = 'professor'
  group by p.escola_id
) pf on pf.escola_id = e.id;

-- Create view: matriculas_por_ano
-- Aggregates matriculas per year and school.
create or replace view public.matriculas_por_ano as
select
  m.escola_id,
  to_char(to_timestamp(extract(epoch from coalesce(m.created_at, now()))), 'YYYY') as ano,
  count(*)::int as total
from public.matriculas m
group by m.escola_id, to_char(to_timestamp(extract(epoch from coalesce(m.created_at, now()))), 'YYYY');

-- Create view: pagamentos_status
-- Aggregates pagamentos count by status per school.
create or replace view public.pagamentos_status as
select
  p.escola_id,
  coalesce(p.status, 'desconhecido') as status,
  count(*)::int as total
from public.pagamentos p
group by p.escola_id, coalesce(p.status, 'desconhecido');

