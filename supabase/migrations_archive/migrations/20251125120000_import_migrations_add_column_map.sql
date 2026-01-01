alter table public.import_migrations
  add column if not exists column_map jsonb;
