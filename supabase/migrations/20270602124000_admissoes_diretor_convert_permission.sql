BEGIN;

DO $$
DECLARE
  v_function_sql text;
BEGIN
  SELECT pg_get_functiondef(
    'public.admissao_convert_to_matricula(uuid,uuid,jsonb)'::regprocedure
  )
  INTO v_function_sql;

  IF v_function_sql IS NULL THEN
    RAISE EXCEPTION 'Função admissao_convert_to_matricula não encontrada.';
  END IF;

  v_function_sql := replace(
    v_function_sql,
    'array[''secretaria'',''admin'',''admin_escola'',''staff_admin'',''financeiro'']',
    'array[''secretaria'',''admin'',''admin_escola'',''staff_admin'',''financeiro'',''diretor'']'
  );

  EXECUTE v_function_sql;
END $$;

COMMIT;
