-- Padroniza preços por classe/curso e entrega IDs corretos na view de turmas.

-- 1) Garantir constraint de unicidade e sanity-check em financeiro_tabelas
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'financeiro_tabelas_unq_escola_ano_curso_classe'
  ) then
    alter table financeiro_tabelas
      add constraint financeiro_tabelas_unq_escola_ano_curso_classe
      unique (escola_id, ano_letivo, curso_id, classe_id);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'financeiro_tabelas_dia_vencimento_chk'
  ) then
    alter table financeiro_tabelas
      add constraint financeiro_tabelas_dia_vencimento_chk
      check (dia_vencimento is null or (dia_vencimento between 1 and 31));
  end if;
end$$;

-- Índice de busca por escola/ano (idempotente)
create index if not exists idx_fin_tabelas_escola_ano on financeiro_tabelas (escola_id, ano_letivo);

-- 2) View de turmas pronta para matrícula, com curso_id/classe_id resolvidos
drop view if exists vw_turmas_para_matricula;

create or replace view vw_turmas_para_matricula as
with base as (
  select
    t.id,
    t.escola_id,
    t.session_id,
    t.nome as turma_nome,
    t.turno,
    t.capacidade_maxima,
    t.sala,
    t.classe_id,
    t.curso_id as turma_curso_id,
    t.ano_letivo,
    coalesce(co.curso_id, cl.curso_id, t.curso_id) as curso_id_resolved,
    cl.nome as classe_nome
  from turmas t
  left join classes cl on t.classe_id = cl.id
  left join cursos_oferta co on co.turma_id = t.id
)
select
  b.id,
  b.escola_id,
  b.session_id,
  b.turma_nome,
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
  (select count(*) from matriculas m where m.turma_id = b.id and m.status in ('ativa','ativo')) as ocupacao_atual,
  (select max(created_at) from matriculas m where m.turma_id = b.id) as ultima_matricula
from base b
left join cursos c on b.curso_id_resolved = c.id
left join cursos_globais_cache cgc on c.curso_global_id = cgc.hash;

grant select on vw_turmas_para_matricula to anon, authenticated, service_role;

