-- apps/web/supabase/migrations/20250917_add_aluno_portal_enabled.sql

alter table public.escolas
  add column if not exists aluno_portal_enabled boolean not null default false;

comment on column public.escolas.aluno_portal_enabled is 'Libera o acesso ao Portal do Aluno para esta escola';

notify pgrst, 'reload schema';

