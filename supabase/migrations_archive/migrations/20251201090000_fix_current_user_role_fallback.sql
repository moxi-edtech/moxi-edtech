-- Ensure RLS role detection works for users whose role is in user_metadata
-- or only in profiles, not just in app_metadata.
-- This makes check_super_admin_role() robust without relying solely on app_metadata.

create or replace function public.current_user_role()
returns text
language sql stable
as $$
  select coalesce(
    nullif((current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role'), ''),
    nullif((current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role'), ''),
    (select role::text from public.profiles where user_id = auth.uid() limit 1),
    ''
  );
$$;

