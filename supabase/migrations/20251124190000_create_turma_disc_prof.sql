-- Create association table: turma_disciplinas_professores (TDP)
-- Links a turma to a disciplina taught by a professor, with optional horario/planejamento payloads.

-- Safety: create only if it doesn't exist (idempotent for local dev)
create table if not exists public.turma_disciplinas_professores (
  id uuid default gen_random_uuid() primary key,
  escola_id uuid not null references public.escolas(id) on delete cascade,
  turma_id uuid not null references public.turmas(id) on delete cascade,
  -- disciplina_id: manter a coluna agora e anexar FK condicionalmente (se a tabela existir)
  disciplina_id uuid not null,
  professor_id uuid not null references public.professores(id) on delete cascade,
  horarios jsonb,
  planejamento jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint uq_tdp_unique unique (turma_id, disciplina_id)
);

-- Basic bookkeeping
create index if not exists idx_tdp_escola on public.turma_disciplinas_professores (escola_id);
create index if not exists idx_tdp_turma on public.turma_disciplinas_professores (turma_id);
create index if not exists idx_tdp_disciplina on public.turma_disciplinas_professores (disciplina_id);
create index if not exists idx_tdp_professor on public.turma_disciplinas_professores (professor_id);

-- Anexar FK para disciplinas apenas se a tabela existir (compatível com ambientes sem 'disciplinas')
do $$
begin
  if to_regclass('public.disciplinas') is not null then
    -- Garantir que a constraint não exista antes de criar
    if not exists (
      select 1 from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      where t.relname = 'turma_disciplinas_professores' and c.conname = 'tdp_disciplina_id_fkey'
    ) then
      execute 'alter table public.turma_disciplinas_professores
               add constraint tdp_disciplina_id_fkey
               foreign key (disciplina_id) references public.disciplinas(id) on delete cascade';
    end if;
  else
    raise notice 'Tabela public.disciplinas não encontrada; FK de disciplina será adicionada quando disponível.';
  end if;
end$$;

-- RLS aligned with tenant isolation helpers (if present)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='turma_disciplinas_professores'
  ) then
    execute 'alter table public.turma_disciplinas_professores enable row level security';
    execute 'alter table public.turma_disciplinas_professores force row level security';
    -- Select/Insert/Update/Delete allowed for staff of the same escola (using helper is_staff_escola if available)
    begin
      execute 'create policy tdp_select_membro on public.turma_disciplinas_professores
        for select to authenticated using (public.is_membro_escola(escola_id))';
    exception when others then null; end;
    begin
      execute 'create policy tdp_insert_staff on public.turma_disciplinas_professores
        for insert to authenticated with check (public.is_staff_escola(escola_id))';
    exception when others then null; end;
    begin
      execute 'create policy tdp_update_staff on public.turma_disciplinas_professores
        for update to authenticated using (public.is_staff_escola(escola_id)) with check (public.is_staff_escola(escola_id))';
    exception when others then null; end;
    begin
      execute 'create policy tdp_delete_staff on public.turma_disciplinas_professores
        for delete to authenticated using (public.is_staff_escola(escola_id))';
    exception when others then null; end;
  end if;
end$$;

-- Trigger to keep updated_at current
create or replace function public.trg_touch_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end$$ language plpgsql;

drop trigger if exists trg_tdp_touch on public.turma_disciplinas_professores;
create trigger trg_tdp_touch before update on public.turma_disciplinas_professores
for each row execute function public.trg_touch_updated_at();
