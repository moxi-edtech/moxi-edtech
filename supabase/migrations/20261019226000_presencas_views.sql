begin;

create or replace view public.vw_presencas_por_turma as
select
  p.escola_id,
  p.turma_id,
  m.id as matricula_id,
  p.aluno_id,
  a.nome as aluno_nome,
  p.data,
  p.status,
  p.disciplina_id,
  p.created_at
from public.presencas p
join public.alunos a on a.id = p.aluno_id
left join public.matriculas m
  on m.aluno_id = p.aluno_id
  and m.turma_id = p.turma_id
  and m.escola_id = p.escola_id
  and m.status in ('ativo','ativa','active');

create or replace view public.vw_frequencia_resumo_aluno as
select
  p.escola_id,
  p.turma_id,
  p.aluno_id,
  count(*) as total_registros,
  count(*) filter (where p.status = 'presente') as presentes,
  count(*) filter (where p.status = 'falta') as faltas,
  count(*) filter (where p.status = 'atraso') as atrasos,
  case
    when count(*) = 0 then 0
    else round((count(*) filter (where p.status = 'presente')::numeric / count(*)::numeric) * 100, 2)
  end as percentual_presenca
from public.presencas p
group by p.escola_id, p.turma_id, p.aluno_id;

create or replace function public.professor_list_presencas_turma(
  p_turma_id uuid,
  p_data_inicio date,
  p_data_fim date
)
returns table (
  escola_id uuid,
  turma_id uuid,
  matricula_id uuid,
  aluno_id uuid,
  aluno_nome text,
  data date,
  status text,
  disciplina_id uuid
)
language sql
security invoker
set search_path = public
as $$
  select
    v.escola_id,
    v.turma_id,
    v.matricula_id,
    v.aluno_id,
    v.aluno_nome,
    v.data,
    v.status,
    v.disciplina_id
  from public.vw_presencas_por_turma v
  where v.turma_id = p_turma_id
    and v.data between p_data_inicio and p_data_fim
    and v.escola_id = public.current_tenant_escola_id()
    and exists (
      select 1
      from public.professores pr
      where pr.profile_id = auth.uid()
        and pr.escola_id = v.escola_id
        and (
          exists (
            select 1
            from public.turma_disciplinas td
            where td.turma_id = v.turma_id
              and td.escola_id = v.escola_id
              and td.professor_id = pr.id
          )
          or exists (
            select 1
            from public.turma_disciplinas_professores tdp
            where tdp.turma_id = v.turma_id
              and tdp.escola_id = v.escola_id
              and tdp.professor_id = pr.id
          )
        )
    );
$$;

grant select on public.vw_presencas_por_turma to authenticated;
grant select on public.vw_frequencia_resumo_aluno to authenticated;
grant execute on function public.professor_list_presencas_turma(uuid, date, date) to authenticated;

notify pgrst, 'reload schema';

commit;
