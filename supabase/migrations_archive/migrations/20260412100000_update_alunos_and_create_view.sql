BEGIN;

-- These UPDATE and SELECT statements are commented out because they contain
-- placeholder UUIDs ('PUT_ID_1_HERE', etc.) which caused the migration to fail.
-- Please replace the placeholders with actual UUIDs and uncomment if these
-- data manipulations are required, or handle them manually.

-- UPDATE the three IDs to status = 'inativo'
-- UPDATE public.alunos
-- SET status = 'inativo', updated_at = timezone('utc', now())
-- WHERE id IN (
--   'PUT_ID_1_HERE',
--   'PUT_ID_2_HERE',
--   'PUT_ID_3_HERE'
-- );

-- Validate number of rows affected
-- SELECT count(*) AS updated_rows FROM public.alunos WHERE status = 'inativo' AND id IN (
--   'PUT_ID_1_HERE',
--   'PUT_ID_2_HERE',
--   'PUT_ID_3_HERE'
-- );

-- 2) Create view for active students
CREATE OR REPLACE VIEW public.vw_alunos_active AS
SELECT * FROM public.alunos
WHERE deleted_at IS NULL AND status = 'ativo';

COMMIT;