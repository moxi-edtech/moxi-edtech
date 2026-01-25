alter table public.alunos add column if not exists nome_busca text;

create or replace function public.sync_alunos_nome_busca()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.nome_busca := lower(unaccent(coalesce(new.nome_completo, new.nome, '')));
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_alunos_nome_busca') then
    create trigger trg_alunos_nome_busca
    before insert or update of nome, nome_completo
    on public.alunos
    for each row execute function public.sync_alunos_nome_busca();
  end if;
end $$;

update public.alunos
set nome_busca = lower(unaccent(coalesce(nome_completo, nome, '')))
where nome_busca is null;

create index if not exists idx_alunos_escola_nome_busca
  on public.alunos (escola_id, nome_busca, id);

create index if not exists idx_turmas_escola_ano_nome
  on public.turmas (escola_id, ano_letivo, nome, id);

create index if not exists idx_turmas_escola_ano_curso
  on public.turmas (escola_id, ano_letivo, curso_id, nome, id);

create index if not exists idx_turmas_escola_ano_classe
  on public.turmas (escola_id, ano_letivo, classe_id, nome, id);

create index if not exists idx_matriculas_escola_status_turma
  on public.matriculas (escola_id, status, turma_id);

create index if not exists idx_candidaturas_escola_status_created
  on public.candidaturas (escola_id, status, created_at desc, id);

create index if not exists idx_import_migrations_escola_status_created
  on public.import_migrations (escola_id, status, created_at desc, id);

create index if not exists idx_staging_alunos_escola_import
  on public.staging_alunos (escola_id, import_id, turma_codigo, id);
