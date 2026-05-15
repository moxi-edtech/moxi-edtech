BEGIN;

ALTER TABLE public.turmas
ALTER COLUMN capacidade_maxima SET DEFAULT 70;

UPDATE public.turmas
SET capacidade_maxima = 70
WHERE capacidade_maxima IS DISTINCT FROM 70;

DO $$
DECLARE
  v_fn_oid oid;
  v_fn_ddl text;
BEGIN
  v_fn_oid := to_regprocedure('public.gerar_turmas_from_curriculo(uuid,uuid,integer,jsonb)');
  IF v_fn_oid IS NOT NULL THEN
    SELECT replace(
      pg_get_functiondef(v_fn_oid),
      'COALESCE(v_capacidade_maxima, 35)',
      'COALESCE(v_capacidade_maxima, 70)'
    )
      INTO v_fn_ddl;
    EXECUTE v_fn_ddl;
  END IF;

  v_fn_oid := to_regprocedure('public.gerar_turmas_from_curriculo(uuid,uuid,integer,jsonb,text)');
  IF v_fn_oid IS NOT NULL THEN
    SELECT replace(
      pg_get_functiondef(v_fn_oid),
      'COALESCE(v_capacidade_maxima, 35)',
      'COALESCE(v_capacidade_maxima, 70)'
    )
      INTO v_fn_ddl;
    EXECUTE v_fn_ddl;
  END IF;
END $$;

COMMIT;
