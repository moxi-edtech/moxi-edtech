-- KLASSE — View de boletim consolidado (notas + faltas)

create or replace view public.vw_boletim_consolidado as
with notas_base as (
  select
    m.escola_id,
    m.aluno_id,
    m.id as matricula_id,
    td.id as turma_disciplina_id,
    dc.nome as disciplina,
    a.trimestre,
    avg(n.valor) as nota_final
  from public.matriculas m
  join public.turma_disciplinas td
    on td.turma_id = m.turma_id
   and td.escola_id = m.escola_id
  join public.curso_matriz cm
    on cm.id = td.curso_matriz_id
  join public.disciplinas_catalogo dc
    on dc.id = cm.disciplina_id
  left join public.avaliacoes a
    on a.turma_disciplina_id = td.id
   and a.escola_id = m.escola_id
  left join public.notas n
    on n.avaliacao_id = a.id
   and n.matricula_id = m.id
  where m.status in ('ativo', 'ativa', 'active')
  group by
    m.escola_id,
    m.aluno_id,
    m.id,
    td.id,
    dc.nome,
    a.trimestre
),
faltas as (
  select
    f.escola_id,
    f.matricula_id,
    td.id as turma_disciplina_id,
    pl.numero as trimestre,
    count(*) filter (where f.status = 'falta') as faltas_total
  from public.frequencias f
  join public.aulas au
    on au.id = f.aula_id
  join public.turma_disciplinas td
    on td.id = au.turma_disciplina_id
   and td.escola_id = f.escola_id
  join public.matriculas m
    on m.id = f.matricula_id
   and m.escola_id = f.escola_id
  join public.anos_letivos al
    on al.escola_id = m.escola_id
   and al.ano = m.ano_letivo
  join public.periodos_letivos pl
    on pl.escola_id = f.escola_id
   and pl.ano_letivo_id = al.id
   and pl.tipo = 'TRIMESTRE'
   and au.data between pl.data_inicio and pl.data_fim
  group by f.escola_id, f.matricula_id, td.id, pl.numero
)
select
  nb.aluno_id,
  nb.disciplina,
  nb.trimestre,
  nb.nota_final,
  coalesce(f.faltas_total, 0) as faltas_total
from notas_base nb
left join faltas f
  on f.escola_id = nb.escola_id
 and f.matricula_id = nb.matricula_id
 and f.turma_disciplina_id = nb.turma_disciplina_id
 and f.trimestre = nb.trimestre;

grant select on public.vw_boletim_consolidado to authenticated;
