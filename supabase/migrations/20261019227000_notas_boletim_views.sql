begin;

drop index if exists public.uq_notas_matricula_avaliacao;

create unique index if not exists uq_notas_matricula_avaliacao
  on public.notas (escola_id, matricula_id, avaliacao_id);

create or replace view public.vw_boletim_por_matricula as
with base as (
  select
    m.id as matricula_id,
    m.aluno_id,
    m.turma_id,
    m.escola_id,
    td.id as turma_disciplina_id,
    cm.disciplina_id,
    dc.nome as disciplina_nome,
    dc.sigla as disciplina_sigla
  from public.matriculas m
  join public.turma_disciplinas td on td.turma_id = m.turma_id and td.escola_id = m.escola_id
  join public.curso_matriz cm on cm.id = td.curso_matriz_id
  join public.disciplinas_catalogo dc on dc.id = cm.disciplina_id
  where m.status in ('ativo','ativa','active')
),
avaliacoes as (
  select
    b.matricula_id,
    b.aluno_id,
    b.turma_id,
    b.escola_id,
    b.ano_letivo,
    b.turma_disciplina_id,
    b.disciplina_id,
    b.disciplina_nome,
    b.disciplina_sigla,
    a.id as avaliacao_id,
    a.nome as avaliacao_nome,
    a.tipo as avaliacao_tipo,
    a.trimestre
  from base b
  left join public.avaliacoes a
    on a.turma_disciplina_id = b.turma_disciplina_id
    and a.ano_letivo = b.ano_letivo
),
notas as (
  select
    a.matricula_id,
    a.aluno_id,
    a.turma_id,
    a.escola_id,
    a.ano_letivo,
    a.turma_disciplina_id,
    a.disciplina_id,
    a.disciplina_nome,
    a.disciplina_sigla,
    a.avaliacao_id,
    a.avaliacao_nome,
    a.avaliacao_tipo,
    a.trimestre,
    n.valor as nota
  from avaliacoes a
  left join public.notas n on n.matricula_id = a.matricula_id and n.avaliacao_id = a.avaliacao_id
)
select
  n.escola_id,
  n.matricula_id,
  n.aluno_id,
  n.turma_id,
  n.ano_letivo,
  n.disciplina_id,
  n.disciplina_nome,
  n.disciplina_sigla,
  n.trimestre,
  jsonb_object_agg(
    coalesce(n.avaliacao_tipo, n.avaliacao_nome),
    n.nota
  ) filter (where coalesce(n.avaliacao_tipo, n.avaliacao_nome) is not null) as notas_por_tipo,
  count(n.avaliacao_id) filter (where n.avaliacao_id is not null) as total_avaliacoes,
  count(n.nota) filter (where n.nota is not null) as total_notas,
  case
    when count(n.avaliacao_id) filter (where n.avaliacao_id is not null) = 0 then 1
    else greatest(
      count(n.avaliacao_id) filter (where n.avaliacao_id is not null)
      - count(n.nota) filter (where n.nota is not null),
      0
    )
  end as missing_count,
  case
    when count(n.nota) filter (where n.nota is not null) = 0 then true
    else count(n.nota) filter (where n.nota is not null)
      < count(n.avaliacao_id) filter (where n.avaliacao_id is not null)
  end as has_missing
from notas n
group by
  n.escola_id,
  n.matricula_id,
  n.aluno_id,
  n.turma_id,
  n.ano_letivo,
  n.disciplina_id,
  n.disciplina_nome,
  n.disciplina_sigla,
  n.trimestre;

grant select on public.vw_boletim_por_matricula to authenticated;

notify pgrst, 'reload schema';

commit;
