begin;

-- 1) Garantir que turma_codigo esteja preenchido onde houver turma_code
update public.turmas
set turma_codigo = turma_code
where turma_codigo is null
  and turma_code is not null;

-- 2) Criar UNIQUE baseado no SSOT
create unique index if not exists uq_turmas_ssot
on public.turmas (escola_id, ano_letivo, turma_codigo)
where turma_codigo is not null;

commit;
