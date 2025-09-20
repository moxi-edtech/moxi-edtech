-- apps/web/supabase/migrations/20250918_mv_insights_views.sql
-- High-level MV-backed views for quick insights, tenant-scoped.

-- Top turmas hoje by presença (percent), includes turma.nome
create or replace view public.v_top_turmas_hoje as
with agg as (
  select f.escola_id, m.turma_id, f.data as dia,
         count(*)::int as total,
         count(*) filter (where f.status = 'presente')::int as presentes
  from public.frequencias f
  join public.matriculas m on m.id = f.matricula_id
  where f.data = current_date
  group by 1,2,3
)
select a.escola_id,
       a.turma_id,
       t.nome as turma_nome,
       a.total,
       a.presentes,
       case when a.total > 0 then round((a.presentes::numeric / a.total::numeric) * 100.0, 1) else null end as percent
from agg a
join public.turmas t on t.id = a.turma_id
where a.escola_id = public.current_tenant_escola_id();

-- Top cursos by média, includes curso nome
create or replace view public.v_top_cursos_media as
select l.escola_id,
       a.curso_oferta_id,
       c.nome as curso_nome,
       avg(l.valor)::numeric(10,2) as media
from public.lancamentos l
join public.avaliacoes a on a.id = l.avaliacao_id
join public.cursos_oferta co on co.id = a.curso_oferta_id
join public.cursos c on c.id = co.curso_id
where l.escola_id = public.current_tenant_escola_id()
group by 1,2,3;

do $$ begin
  grant select on table public.v_top_turmas_hoje to anon, authenticated;
  grant select on table public.v_top_cursos_media to anon, authenticated;
exception when others then null; end $$;

