-- apps/web/supabase/migrations/20250918_escolas_use_mv_flag.sql
-- Adds a flag to control whether dashboards should use MV-backed queries.

alter table public.escolas
  add column if not exists use_mv_dashboards boolean not null default true;

comment on column public.escolas.use_mv_dashboards is 'Quando true, páginas preferem ler views MV (v_*) para baixa latência.';

