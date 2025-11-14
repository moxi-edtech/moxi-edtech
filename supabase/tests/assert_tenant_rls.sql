-- Ensures that every table with an escola_id column has RLS + FORCE RLS enabled
-- and at least one policy defined. Intended to run via `supabase test db`.
DO $$
DECLARE
  rec record;
  missing_policy text;
  missing_force text;
BEGIN
  FOR rec IN
    SELECT c.oid, c.relname AS table_name
    FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND a.attname = 'escola_id'
  LOOP
    -- Ensure at least one policy exists
    SELECT p.policyname
      INTO missing_policy
      FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = rec.table_name
      LIMIT 1;

    IF missing_policy IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = format('Tabela %s não possui políticas de RLS definidas.', rec.table_name);
    END IF;

    -- Ensure FORCE ROW LEVEL SECURITY is active
    SELECT CASE WHEN c.relforcerowsecurity THEN NULL ELSE c.relname END
      INTO missing_force
      FROM pg_class c
      WHERE c.oid = rec.oid;

    IF missing_force IS NOT NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = format('Tabela %s precisa de FORCE ROW LEVEL SECURITY.', rec.table_name);
    END IF;
  END LOOP;
END;
$$;
