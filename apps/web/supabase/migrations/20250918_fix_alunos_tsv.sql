-- apps/web/supabase/migrations/20250918_fix_alunos_tsv.sql
-- Recreate alunos.tsv generated column with a safe expression depending on
-- which name columns exist (nome, responsavel_nome, nome_responsavel).

do $$
declare
  has_nome boolean;
  has_resp_nome boolean;
  has_nome_resp boolean;
  expr text := '';
begin
  select exists (
    select 1 from information_schema.columns 
    where table_schema='public' and table_name='alunos' and column_name='nome'
  ) into has_nome;
  select exists (
    select 1 from information_schema.columns 
    where table_schema='public' and table_name='alunos' and column_name='responsavel_nome'
  ) into has_resp_nome;
  select exists (
    select 1 from information_schema.columns 
    where table_schema='public' and table_name='alunos' and column_name='nome_responsavel'
  ) into has_nome_resp;

  expr := 'to_tsvector(''simple'', '' '')';
  if has_nome then
    expr := 'coalesce((alunos.nome)::text, '''')';
  end if;
  if has_resp_nome then
    expr := expr || ' || '' '' || coalesce((alunos.responsavel_nome)::text, '''')';
  end if;
  if has_nome_resp then
    expr := expr || ' || '' '' || coalesce((alunos.nome_responsavel)::text, '''')';
  end if;

  -- Drop existing tsv if generated definition might be wrong
  if exists (
    select 1 from information_schema.columns where table_schema='public' and table_name='alunos' and column_name='tsv'
  ) then
    begin
      execute 'alter table public.alunos drop column tsv';
    exception when undefined_column then null; end;
  end if;

  -- Recreate with computed expression
  execute 'alter table public.alunos add column if not exists tsv tsvector generated always as (' || 'to_tsvector(''simple'', ' || expr || ')' || ') stored';
  -- Index if missing
  create index if not exists ix_alunos_tsv on public.alunos using gin (tsv);
end$$;

