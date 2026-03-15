BEGIN;

DROP FUNCTION IF EXISTS public.lancar_notas_batch(
  uuid,
  uuid,
  uuid,
  uuid,
  integer,
  text,
  jsonb
);

COMMIT;
