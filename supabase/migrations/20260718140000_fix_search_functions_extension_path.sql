BEGIN;

ALTER FUNCTION public.search_alunos_global(uuid, text, integer)
  SET search_path = public, extensions;

ALTER FUNCTION public.search_alunos_global_min(uuid, text, integer)
  SET search_path = public, extensions;

ALTER FUNCTION public.search_alunos_global_min(
  uuid,
  text,
  integer,
  double precision,
  timestamptz,
  timestamptz,
  uuid
)
  SET search_path = public, extensions;

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
  SET search_path = public, extensions;

COMMIT;
