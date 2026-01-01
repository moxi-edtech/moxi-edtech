-- Adiciona classe_id a turmas, caso não exista
alter table public.turmas
  add column if not exists classe_id uuid references public.classes(id) on delete set null;

create index if not exists idx_turmas_classe_id on public.turmas(classe_id);

