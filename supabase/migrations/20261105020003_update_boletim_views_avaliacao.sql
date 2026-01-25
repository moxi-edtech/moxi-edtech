begin;

drop view if exists public.vw_boletim_por_matricula;
drop view if exists public.vw_boletim_consolidado;

create or replace view public.vw_boletim_por_matricula as
with configuracoes as (
  select
    escola_id,
    coalesce(modelo_avaliacao, 'SIMPLIFICADO') as modelo_avaliacao,
    avaliacao_config
  from public.configuracoes_escola
),
componentes as (
  select
    c.escola_id,
    upper(comp.code) as code,
    comp.peso,
    coalesce(comp.ativo, true) as ativo
  from configuracoes c
  left join lateral jsonb_to_recordset(c.avaliacao_config->'componentes')
    as comp(code text, peso numeric, ativo boolean)
    on true
),
base as (
  select
    m.id as matricula_id,
    m.aluno_id,
    m.turma_id,
    m.escola_id,
    m.ano_letivo,
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
    a.trimestre,
    a.peso as avaliacao_peso
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
    a.avaliacao_peso,
    n.valor as nota
  from avaliacoes a
  left join public.notas n on n.matricula_id = a.matricula_id and n.avaliacao_id = a.avaliacao_id
),
calc as (
  select
    n.*,
    coalesce(cfg.modelo_avaliacao, 'SIMPLIFICADO') as modelo_avaliacao,
    coalesce(comp.peso, n.avaliacao_peso, 1) as peso_aplicado
  from notas n
  left join configuracoes cfg on cfg.escola_id = n.escola_id
  left join componentes comp
    on comp.escola_id = n.escola_id
   and comp.ativo is true
   and comp.code = upper(coalesce(n.avaliacao_tipo, n.avaliacao_nome))
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
  case
    when count(n.nota) filter (where n.nota is not null) = 0 then null
    when n.modelo_avaliacao = 'DEPOIS' then avg(n.nota)
    else
      sum(n.nota * n.peso_aplicado) filter (where n.nota is not null)
      / nullif(sum(n.peso_aplicado) filter (where n.nota is not null), 0)
  end as nota_final,
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
from calc n
group by
  n.escola_id,
  n.matricula_id,
  n.aluno_id,
  n.turma_id,
  n.ano_letivo,
  n.disciplina_id,
  n.disciplina_nome,
  n.disciplina_sigla,
  n.trimestre,
  n.modelo_avaliacao;

create or replace view public.vw_boletim_consolidado as
with configuracoes as (
  select
    escola_id,
    coalesce(modelo_avaliacao, 'SIMPLIFICADO') as modelo_avaliacao,
    avaliacao_config
  from public.configuracoes_escola
),
componentes as (
  select
    c.escola_id,
    upper(comp.code) as code,
    comp.peso,
    coalesce(comp.ativo, true) as ativo
  from configuracoes c
  left join lateral jsonb_to_recordset(c.avaliacao_config->'componentes')
    as comp(code text, peso numeric, ativo boolean)
    on true
),
notas_base as (
  select
    m.escola_id,
    m.aluno_id,
    m.id as matricula_id,
    td.id as turma_disciplina_id,
    dc.nome as disciplina,
    a.trimestre,
    coalesce(cfg.modelo_avaliacao, 'SIMPLIFICADO') as modelo_avaliacao,
    n.valor as nota,
    coalesce(comp.peso, a.peso, 1) as peso_aplicado
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
  left join configuracoes cfg
    on cfg.escola_id = m.escola_id
  left join componentes comp
    on comp.escola_id = m.escola_id
   and comp.ativo is true
   and comp.code = upper(coalesce(a.tipo, a.nome))
  where m.status in ('ativo', 'ativa', 'active')
),
notas_final as (
  select
    nb.escola_id,
    nb.aluno_id,
    nb.matricula_id,
    nb.turma_disciplina_id,
    nb.disciplina,
    nb.trimestre,
    case
      when count(nb.nota) filter (where nb.nota is not null) = 0 then null
      when nb.modelo_avaliacao = 'DEPOIS' then avg(nb.nota)
      else
        sum(nb.nota * nb.peso_aplicado) filter (where nb.nota is not null)
        / nullif(sum(nb.peso_aplicado) filter (where nb.nota is not null), 0)
    end as nota_final
  from notas_base nb
  group by
    nb.escola_id,
    nb.aluno_id,
    nb.matricula_id,
    nb.turma_disciplina_id,
    nb.disciplina,
    nb.trimestre,
    nb.modelo_avaliacao
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
from notas_final nb
left join faltas f
  on f.escola_id = nb.escola_id
 and f.matricula_id = nb.matricula_id
 and f.turma_disciplina_id = nb.turma_disciplina_id
 and f.trimestre = nb.trimestre;

grant select on public.vw_boletim_consolidado to authenticated;
grant select on public.vw_boletim_por_matricula to authenticated;

notify pgrst, 'reload schema';

commit;
