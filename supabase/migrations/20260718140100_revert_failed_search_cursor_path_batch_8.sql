BEGIN;

ALTER FUNCTION public.search_alunos_global_min(
  uuid,
  text,
  integer,
  double precision,
  timestamptz,
  timestamptz,
  uuid
)
  SET search_path = public;

ALTER FUNCTION public.search_global_entities(
  uuid,
  text,
  text[],
  integer,
  double precision,
  timestamptz,
  timestamptz,
  uuid
)
  SET search_path = public;

COMMIT;
