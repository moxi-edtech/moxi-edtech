create materialized view if not exists public.mv_turmas_para_matricula as
with base as (
  select
    t.id,
    t.escola_id,
    coalesce(t.session_id, al.id) as session_id,
    t.nome as turma_nome,
    t.turma_codigo,
    t.turno,
    t.capacidade_maxima,
    t.sala,
    t.classe_id,
    t.curso_id as turma_curso_id,
    t.ano_letivo,
    t.status_validacao,
    coalesce(cm_map.curso_id, cl.curso_id, t.curso_id) as curso_id_resolved,
    cl.nome as classe_nome
  from public.turmas t
  left join public.classes cl on t.classe_id = cl.id
  left join lateral (
    select distinct on (td.turma_id) cm.curso_id
    from public.turma_disciplinas td
    join public.curso_matriz cm on cm.id = td.curso_matriz_id
    where td.turma_id = t.id
    order by td.turma_id, cm.created_at desc, cm.id desc
  ) cm_map on true
  left join public.anos_letivos al on al.escola_id = t.escola_id and al.ano = t.ano_letivo
)
select
  b.id,
  b.escola_id,
  b.session_id,
  b.turma_nome,
  b.turma_codigo,
  b.turno,
  b.capacidade_maxima,
  b.sala,
  coalesce(b.classe_nome, 'Classe não definida') as classe_nome,
  coalesce(c.nome, 'Ensino Geral') as curso_nome,
  coalesce(c.tipo, 'geral') as curso_tipo,
  coalesce(c.is_custom, false) as curso_is_custom,
  cgc.hash as curso_global_hash,
  b.classe_id,
  b.curso_id_resolved as curso_id,
  b.ano_letivo,
  (select count(*) from public.matriculas m where m.turma_id = b.id and m.status in ('ativa', 'ativo')) as ocupacao_atual,
  (select max(created_at) from public.matriculas m where m.turma_id = b.id) as ultima_matricula,
  b.status_validacao
from base b
left join public.cursos c on b.curso_id_resolved = c.id
left join public.cursos_globais_cache cgc on c.curso_global_id = cgc.hash;

create unique index if not exists ux_mv_turmas_para_matricula
  on public.mv_turmas_para_matricula (escola_id, id);

create or replace view public.vw_turmas_para_matricula as
select *
from public.mv_turmas_para_matricula
where escola_id = public.current_tenant_escola_id();

grant select on public.mv_turmas_para_matricula to anon, authenticated, service_role;
grant select on public.vw_turmas_para_matricula to anon, authenticated, service_role;

create or replace function public.refresh_mv_turmas_para_matricula()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.mv_turmas_para_matricula;
end;
$$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    if not exists (select 1 from cron.job where jobname = 'refresh_mv_turmas_para_matricula') then
      perform cron.schedule(
        'refresh_mv_turmas_para_matricula',
        '*/10 * * * *',
        'select public.refresh_mv_turmas_para_matricula();'
      );
    end if;
  end if;
end $$;
