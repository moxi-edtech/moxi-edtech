-- apps/web/supabase/migrations/20250917_create_audit_logs.sql
-- Tabela de auditoria unificada para eventos dos portais

create extension if not exists pgcrypto;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid references public.escolas(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  portal text not null check (portal in (
    'admin_escola','secretaria','financeiro','aluno','super_admin','outro'
  )),
  action text not null, -- ex.: MATRICULA_CRIADA, PAGAMENTO_CONFIRMADO, PAGE_VIEW
  entity text not null, -- ex.: matricula, pagamento, aluno, nota, dashboard
  entity_id text null,  -- id livre (uuid ou composto) para referência
  details jsonb not null default '{}'::jsonb, -- payload contextual (campos opcionais)
  created_at timestamptz not null default now()
);

comment on table public.audit_logs is 'Eventos de auditoria por escola/portal/usuário';

-- Índices úteis para filtros
create index if not exists audit_logs_escola_id_idx on public.audit_logs (escola_id);
create index if not exists audit_logs_portal_idx on public.audit_logs (portal);
create index if not exists audit_logs_action_idx on public.audit_logs (action);
create index if not exists audit_logs_created_at_desc_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_details_gin_idx on public.audit_logs using gin (details);

alter table public.audit_logs enable row level security;

-- Política de INSERT: qualquer usuário autenticado pode registrar eventos da própria sessão
create policy if not exists "audit_logs_insert_authenticated"
on public.audit_logs
as permissive for insert
to authenticated
with check (auth.uid() is not null);

-- Helper para extrair role do JWT (app_metadata.role)
create or replace function public.current_user_role() returns text
language sql stable as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role'),
    ''
  );
$$;

-- SELECT: super_admin vê tudo; demais apenas logs da(s) escola(s) em que participa
create policy if not exists "audit_logs_select_by_scope"
on public.audit_logs
as permissive for select
to authenticated
using (
  public.current_user_role() = 'super_admin'
  or exists (
    select 1
    from public.escola_usuarios eu
    where eu.user_id = auth.uid()
      and (eu.escola_id = audit_logs.escola_id or audit_logs.escola_id is null)
  )
);

-- Opcional: DELETE/UPDATE bloqueados (auditoria é somente append)
revoke all on table public.audit_logs from authenticated;
grant select, insert on table public.audit_logs to authenticated;

-- Atualiza cache do PostgREST
notify pgrst, 'reload schema';

