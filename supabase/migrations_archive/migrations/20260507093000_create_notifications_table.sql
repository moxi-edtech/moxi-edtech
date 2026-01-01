-- Migration: create_notifications_table
-- Description: Generic notifications table for cross-portal alerts

create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  escola_id uuid not null references public.escolas(id) on delete cascade,
  target_role public.user_role not null default 'financeiro'::public.user_role,
  tipo text not null,
  titulo text not null,
  mensagem text,
  link_acao text,
  lida boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_escola_target_idx
  on public.notifications (escola_id, target_role, lida, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_select_membro on public.notifications;
drop policy if exists notifications_insert_staff on public.notifications;
drop policy if exists notifications_update_membro on public.notifications;
drop policy if exists notifications_delete_staff on public.notifications;

create policy notifications_select_membro
on public.notifications
for select
to authenticated
using (
  public.is_membro_escola(escola_id)
);

create policy notifications_insert_staff
on public.notifications
for insert
to authenticated
with check (
  public.is_staff_escola(escola_id)
);

create policy notifications_update_membro
on public.notifications
for update
to authenticated
using (
  public.is_membro_escola(escola_id)
)
with check (
  public.is_membro_escola(escola_id)
);

create policy notifications_delete_staff
on public.notifications
for delete
to authenticated
using (
  public.is_staff_escola(escola_id)
);
