BEGIN;

ALTER FUNCTION public.formacao_self_service_create_inscricao(text,text,uuid,text,text,text,text)
  RENAME TO formacao_self_service_create_inscricao_internal;

REVOKE EXECUTE ON FUNCTION public.formacao_self_service_create_inscricao_internal(text,text,uuid,text,text,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.formacao_self_service_create_inscricao_internal(text,text,uuid,text,text,text,text)
  TO service_role;

CREATE FUNCTION public.formacao_self_service_create_inscricao(
  p_escola_slug text,
  p_cohort_ref text,
  p_formando_user_id uuid,
  p_nome text,
  p_email text DEFAULT NULL,
  p_bi_numero text DEFAULT NULL,
  p_telefone text DEFAULT NULL
)
RETURNS public.formacao_inscricoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  v_result public.formacao_inscricoes;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR (SELECT auth.uid()) <> p_formando_user_id THEN
    RAISE EXCEPTION 'FORMANDO_IDENTITY_MISMATCH' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_result
  FROM public.formacao_self_service_create_inscricao_internal(
    p_escola_slug,
    p_cohort_ref,
    p_formando_user_id,
    p_nome,
    p_email,
    p_bi_numero,
    p_telefone
  );

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.formacao_self_service_create_inscricao(text,text,uuid,text,text,text,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.formacao_self_service_create_inscricao(text,text,uuid,text,text,text,text)
  TO authenticated, service_role;

COMMIT;
