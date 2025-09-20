-- apps/web/supabase/migrations/20250917_create_onboarding_drafts.sql
-- Stores onboarding drafts per (escola_id, user_id).

create table if not exists public.onboarding_drafts (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null,
  user_id uuid not null,
  data jsonb not null default '{}'::jsonb,
  step int2 not null default 1,
  updated_at timestamptz not null default now(),
  constraint onboarding_drafts_escola_user_unique unique (escola_id, user_id),
  constraint onboarding_drafts_escola_fk foreign key (escola_id) references public.escolas (id) on delete cascade
);

alter table public.onboarding_drafts enable row level security;

-- Service role will bypass RLS. Policies below are optional, but help if you ever switch to client writes.
do $$ begin
  create policy if not exists "onboarding_drafts_select_own" on public.onboarding_drafts
    for select to authenticated
    using (auth.uid() = user_id);
exception when others then null; end $$;

do $$ begin
  create policy if not exists "onboarding_drafts_upsert_own" on public.onboarding_drafts
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when others then null; end $$;

-- Ensure PostgREST (Supabase) reloads its schema cache
notify pgrst, 'reload schema';

