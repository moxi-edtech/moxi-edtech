-- apps/web/supabase/migrations/20250917_add_logo_url_to_escolas.sql
-- Adds logo_url to escolas to store public URL of the school's logo.

do $$ begin
  alter table public.escolas
    add column if not exists logo_url text;
exception when others then null; end $$;

-- Optional: index if you frequently filter by logo_url (usually not necessary)
-- create index if not exists idx_escolas_logo_url on public.escolas (logo_url);

notify pgrst, 'reload schema';

