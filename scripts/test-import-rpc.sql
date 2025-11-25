-- Sanity check for public.importar_alunos RPC
-- Usage:
--   export DB_URL="postgresql://<user>:<pass>@<host>:5432/postgres?sslmode=require"
--   psql "$DB_URL" -f scripts/test-import-rpc.sql
\set ON_ERROR_STOP on

BEGIN;

-- Pick any escola and profile from existing data
SELECT id AS escola_id FROM public.escolas LIMIT 1;\gset
SELECT user_id AS profile_id FROM public.profiles LIMIT 1;\gset

-- Guard: ensure we found required IDs
DO $$
BEGIN
  IF current_setting('psql.escola_id', true) IS NULL THEN
    RAISE EXCEPTION 'No escolas found. Please create an escola first.';
  END IF;
  IF current_setting('psql.profile_id', true) IS NULL THEN
    RAISE EXCEPTION 'No profiles found. Please create a profile first.';
  END IF;
END $$;

-- Create a test import_migration row
INSERT INTO public.import_migrations (escola_id, created_by, file_name, status, total_rows)
VALUES (:'escola_id', :'profile_id', 'rpc-sanity.csv', 'uploaded', 1)
RETURNING id AS import_id;\gset

-- Stage one aluno
INSERT INTO public.staging_alunos (
  import_id, escola_id, profile_id, nome, data_nascimento, telefone, bi, email, raw_data
) VALUES (
  :'import_id', :'escola_id', :'profile_id',
  'Aluno RPC Sanity', current_date - INTERVAL '10 years', '900000000', 'BI-RPC-TEST-001', 'rpc-test@example.com', '{}'::jsonb
);

-- Call the RPC
SELECT 'RPC_RESULT' AS tag, * FROM public.importar_alunos(:'import_id'::uuid, :'escola_id'::uuid);

-- Summaries
SELECT 'IMPORT_SUMMARY' AS tag, imported_rows, error_rows, status
FROM public.import_migrations WHERE id = :'import_id';

SELECT 'ERRORS' AS tag, e.* FROM public.import_errors e WHERE e.import_id = :'import_id' ORDER BY e.id;

-- Optional cleanup (uncomment to remove artifacts)
-- DELETE FROM public.alunos WHERE import_id = :'import_id';
-- DELETE FROM public.staging_alunos WHERE import_id = :'import_id';
-- DELETE FROM public.import_migrations WHERE id = :'import_id';

COMMIT;

