BEGIN;

ALTER TABLE public.escola_users
  DROP CONSTRAINT IF EXISTS escola_users_papel_check;

ALTER TABLE public.escola_users
  ADD CONSTRAINT escola_users_papel_check
  CHECK (
    papel = ANY (
      ARRAY[
        'admin',
        'staff_admin',
        'financeiro',
        'secretaria',
        'aluno',
        'professor',
        'admin_escola',
        'admin_financeiro',
        'secretaria_financeiro',
        'diretor',
        'formacao_admin',
        'formacao_secretaria',
        'formacao_financeiro',
        'formador',
        'formando'
      ]::text[]
    )
  );

DO $$
DECLARE
  v_function_sql text;
BEGIN
  SELECT pg_get_functiondef(
    'public.admissao_finalizar_matricula(uuid,uuid,uuid,jsonb,text,text,boolean,text)'::regprocedure
  )
  INTO v_function_sql;

  IF v_function_sql IS NULL THEN
    RAISE EXCEPTION 'Função admissao_finalizar_matricula com override não encontrada.';
  END IF;

  v_function_sql := replace(
    v_function_sql,
    'array[''secretaria'',''admin'',''admin_escola'',''staff_admin'',''financeiro'']',
    'array[''secretaria'',''admin'',''admin_escola'',''staff_admin'',''financeiro'',''diretor'']'
  );

  EXECUTE v_function_sql;
END $$;

COMMIT;
