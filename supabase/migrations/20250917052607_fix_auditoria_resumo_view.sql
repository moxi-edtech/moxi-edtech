create or replace view public.auditoria_resumo_escolas as
with base as (
  select
    e.id as escola_id,
    e.nome,
    e.nif
  from public.escolas e
)
select
  b.escola_id,
  b.nome as escola_nome,
  b.nif,
  -- contagens
  coalesce((
    select count(*) from public.escola_auditoria ea
    where ea.escola_id = b.escola_id and ea.acao = 'criada'
  ),0) as vezes_criada,
  coalesce((
    select count(*) from public.escola_auditoria ea
    where ea.escola_id = b.escola_id and ea.acao = 'reutilizada'
  ),0) as vezes_reutilizada,
  -- primeira e última ação
  (select min(ea.criado_em) from public.escola_auditoria ea where ea.escola_id = b.escola_id) as primeira_acao,
  (select max(ea.criado_em) from public.escola_auditoria ea where ea.escola_id = b.escola_id) as ultima_acao,
  -- últimas 3 turmas criadas
  (
    select jsonb_agg(jsonb_build_object('nome', nome, 'criado_em', criado_em) order by criado_em desc)
    from (
      select t.nome, ta.criado_em
      from public.turmas_auditoria ta
      join public.turmas t on t.id = ta.turma_id
      where ta.escola_id = b.escola_id and ta.acao = 'criada'
      order by ta.criado_em desc
      limit 3
    ) as turmas_sub
  ) as ultimas_turmas,
  -- últimas 3 disciplinas criadas
  (
    select jsonb_agg(jsonb_build_object('nome', nome, 'criado_em', criado_em) order by criado_em desc)
    from (
      select d.nome, da.criado_em
      from public.disciplinas_auditoria da
      join public.disciplinas d on d.id = da.disciplina_id
      where da.escola_id = b.escola_id and da.acao = 'criada'
      order by da.criado_em desc
      limit 3
    ) as disciplinas_sub
  ) as ultimas_disciplinas
from base b;
