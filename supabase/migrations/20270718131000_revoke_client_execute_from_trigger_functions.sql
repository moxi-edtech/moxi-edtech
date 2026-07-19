BEGIN;

-- Trigger functions are invoked by PostgreSQL through their triggers. They
-- must not be exposed as client-callable RPCs.
DO $migration$
DECLARE
  v_function regprocedure;
BEGIN
  SET LOCAL search_path = pg_catalog;

  FOR v_function IN
    SELECT p.oid::regprocedure
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prorettype = 'pg_catalog.trigger'::regtype
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      v_function
    );
  END LOOP;
END;
$migration$;

COMMIT;
