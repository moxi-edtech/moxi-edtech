# Diff proposto — Agent 3
run_id: 01399CF5-080B-4BEC-B0EE-ED31C5893C16
timestamp: 2026-07-19T04:30:00Z

## P0
`P0_CHECKLIST.md` verificado: nenhum item em FAIL ou por concluir.

## Acção
Remover UUID/email reais do precheck público Formação e adicionar rate limit no banco.

## Ficheiro proposto
`supabase/migrations/20270718182000_harden_formacao_self_service_precheck.sql`

```sql
CREATE OR REPLACE FUNCTION public.formacao_self_service_precheck(
  p_escola_slug text,
  p_cohort_ref text,
  p_bi_numero text
)
RETURNS TABLE(
  escola_id uuid, cohort_id uuid, escola_nome text, cohort_nome text,
  curso_nome text, existing_user_id uuid, existing_email text
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_escola_id uuid;
  v_cohort_id uuid;
  v_escola_nome text;
  v_cohort_nome text;
  v_curso_nome text;
  v_bi_norm text;
  v_rate_limit jsonb;
  v_exists boolean;
BEGIN
  v_bi_norm := nullif(upper(regexp_replace(coalesce(p_bi_numero, ''), '[^A-Za-z0-9]', '', 'g')), '');
  v_rate_limit := public.check_public_rate_limit(
    'formacao_self_service_precheck',
    lower(btrim(coalesce(p_escola_slug, ''))) || ':' ||
      lower(btrim(coalesce(p_cohort_ref, ''))) || ':' || coalesce(v_bi_norm, 'missing'),
    5, 900, 900
  );
  IF NOT coalesce((v_rate_limit->>'allowed')::boolean, false) THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;

  SELECT t.escola_id,t.cohort_id,t.escola_nome,t.cohort_nome,t.curso_nome
  INTO v_escola_id,v_cohort_id,v_escola_nome,v_cohort_nome,v_curso_nome
  FROM public.formacao_self_service_resolve_target(p_escola_slug,p_cohort_ref) t LIMIT 1;
  IF v_escola_id IS NULL OR v_cohort_id IS NULL THEN RAISE EXCEPTION 'TARGET_NOT_FOUND'; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.profiles p
    WHERE p.escola_id=v_escola_id AND v_bi_norm IS NOT NULL
      AND upper(regexp_replace(coalesce(p.bi_numero,''),'[^A-Za-z0-9]','','g'))=v_bi_norm
  ) INTO v_exists;

  RETURN QUERY SELECT v_escola_id,v_cohort_id,v_escola_nome,v_cohort_nome,v_curso_nome,
    CASE WHEN v_exists THEN '00000000-0000-0000-0000-000000000001'::uuid ELSE NULL::uuid END,
    NULL::text;
END;
$function$;
```

## Verificação pós-apply prevista

- Retorno mantém a assinatura esperada pela API.
- Corpo remoto não selecciona `p.user_id` nem `p.email`.
- Rate limit presente antes da consulta de perfil.
- Grants públicos existentes permanecem para o precheck.
