begin;

-- 1) Coluna usada pelo importador / financeiro
alter table public.matriculas
  add column if not exists data_inicio_financeiro date;

-- 2) Rastreabilidade da migração
alter table public.matriculas
  add column if not exists import_id uuid;

-- (opcional, mas recomendado) FK para import_migrations
-- se você quiser integridade forte:
alter table public.matriculas
  drop constraint if exists matriculas_import_id_fkey;

alter table public.matriculas
  add constraint matriculas_import_id_fkey
  foreign key (import_id)
  references public.import_migrations(id)
  on delete set null;

-- Índice para relatórios/debug
create index if not exists idx_matriculas_import_id
  on public.matriculas (import_id);

commit;
