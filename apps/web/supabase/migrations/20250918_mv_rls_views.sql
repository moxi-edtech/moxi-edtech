-- apps/web/supabase/migrations/20250918_mv_rls_views.sql
-- Create filtered views over MVs to enforce tenant scoping without relying on RLS on MVs.

-- Financeiro por dia (scoped)
create or replace view public.v_financeiro_escola_dia as
  select * from public.mv_financeiro_escola_dia
  where escola_id = public.current_tenant_escola_id();

-- Frequência por turma e dia (scoped)
create or replace view public.v_freq_por_turma_dia as
  select * from public.mv_freq_por_turma_dia
  where escola_id = public.current_tenant_escola_id();

-- Média por curso_oferta (scoped)
create or replace view public.v_media_por_curso as
  select * from public.mv_media_por_curso
  where escola_id = public.current_tenant_escola_id();

-- Harden: revoke direct MV access from anon/authenticated, allow on views
do $$ begin
  revoke all on table public.mv_financeiro_escola_dia from anon, authenticated;
  revoke all on table public.mv_freq_por_turma_dia from anon, authenticated;
  revoke all on table public.mv_media_por_curso from anon, authenticated;
exception when others then null; end $$;

do $$ begin
  grant select on table public.v_financeiro_escola_dia to anon, authenticated;
  grant select on table public.v_freq_por_turma_dia to anon, authenticated;
  grant select on table public.v_media_por_curso to anon, authenticated;
exception when others then null; end $$;

