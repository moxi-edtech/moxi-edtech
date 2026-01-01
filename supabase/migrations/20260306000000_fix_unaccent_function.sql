-- Ensure unaccent extension is available and exposed in the public schema
create extension if not exists "unaccent" with schema "extensions";

-- Expose a public alias so functions and generated columns referencing public.unaccent work
create or replace function public.unaccent(text)
returns text
language sql
immutable
as $$
  select extensions.unaccent($1);
$$;

-- Keep immutable_unaccent in sync with the extension location
create or replace function public.immutable_unaccent(text)
returns text
language sql
immutable
parallel safe
set search_path to 'public'
as $$
  select extensions.unaccent($1);
$$;
