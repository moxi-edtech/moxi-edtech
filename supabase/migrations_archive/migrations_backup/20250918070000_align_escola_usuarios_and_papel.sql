-- Align/link table for user membership in schools and ensure 'papel'
-- Idempotent: creates table if missing; adds column/constraint if needed.

-- Create table if it doesn't exist
create table if not exists public.escola_usuarios (
  escola_id uuid not null references public.escolas(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  papel text not null default 'secretaria',
  created_at timestamptz not null default now(),
  primary key (escola_id, user_id)
);

-- If the table existed without 'papel', add it with a sensible default
alter table public.escola_usuarios
  add column if not exists papel text not null default 'secretaria';

-- Constrain allowed values for papel (kept in sync with apps/web/src/lib/permissions.ts)
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'escola_usuarios_papel_check'
      and conrelid = 'public.escola_usuarios'::regclass
  ) then
    alter table public.escola_usuarios
      add constraint escola_usuarios_papel_check
      check (papel in ('admin','staff_admin','financeiro','secretaria','aluno','professor','admin_escola'));
  end if;
end $$;

-- Ensure composite uniqueness if not already enforced by PK in existing DBs
do $$ begin
  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'uq_escola_usuarios_unique'
  ) then
    create unique index if not exists uq_escola_usuarios_unique on public.escola_usuarios (escola_id, user_id);
  end if;
end $$;

