BEGIN;

CREATE OR REPLACE FUNCTION public.get_onboarding_public_handoff(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_token text := upper(trim(coalesce(p_token, '')));
  v_escola_id uuid;
  v_onboarding_finalizado boolean;
  v_needs_academic_setup boolean;
  v_rate_limit jsonb;
  v_readiness jsonb;
  v_badges jsonb;
  v_setup_steps boolean[];
  v_completion_percent integer;
  v_next_action jsonb;
BEGIN
  IF v_token = '' OR length(v_token) > 128 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  v_rate_limit := public.check_public_rate_limit(
    'onboarding_public_handoff', md5(v_token), 30, 300, 900
  );
  IF NOT coalesce((v_rate_limit->>'allowed')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rate_limited');
  END IF;

  SELECT r.escola_id, e.onboarding_finalizado, e.needs_academic_setup
    INTO v_escola_id, v_onboarding_finalizado, v_needs_academic_setup
  FROM public.onboarding_requests r
  JOIN public.escolas e ON e.id = r.escola_id
  WHERE r.tracking_token = v_token
  LIMIT 1;

  IF v_escola_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  v_readiness := public.get_school_operational_readiness(v_escola_id, NULL);
  IF NOT coalesce((v_readiness->>'ok')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'readiness_unavailable');
  END IF;

  v_badges := coalesce(v_readiness->'badges', '{}'::jsonb);
  v_setup_steps := ARRAY[
    coalesce((v_badges->>'ano_letivo_ok')::boolean, false),
    coalesce((v_badges->>'periodos_ok')::boolean, false),
    coalesce((v_badges->>'avaliacao_ok')::boolean, false),
    coalesce((v_badges->>'curriculo_published_ok')::boolean, false),
    coalesce((v_badges->>'turmas_ok')::boolean, false)
  ];
  SELECT round(100.0 * count(*) FILTER (WHERE step_ok) / 5)::integer
    INTO v_completion_percent
  FROM unnest(v_setup_steps) AS step_ok;

  v_next_action := CASE
    WHEN NOT v_setup_steps[1] THEN jsonb_build_object('key', 'CONFIGURE_ANO_LETIVO', 'label', 'Configurar ano letivo')
    WHEN NOT v_setup_steps[2] THEN jsonb_build_object('key', 'CONFIGURE_PERIODOS', 'label', 'Configurar períodos')
    WHEN NOT v_setup_steps[3] THEN jsonb_build_object('key', 'CONFIGURE_AVALIACAO', 'label', 'Configurar avaliação')
    WHEN NOT v_setup_steps[4] THEN jsonb_build_object('key', 'PUBLISH_CURRICULO', 'label', 'Publicar currículo')
    WHEN NOT v_setup_steps[5] THEN jsonb_build_object('key', 'GENERATE_TURMAS', 'label', 'Gerar turmas')
    ELSE jsonb_build_object('key', 'RUN_VALIDATION', 'label', 'Rodar validações')
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'operational_readiness', v_readiness,
    'setup_handoff', jsonb_build_object(
      'ano_letivo', v_readiness->'ano_letivo',
      'onboarding_finalizado', coalesce(v_onboarding_finalizado, false),
      'needs_academic_setup', coalesce(v_needs_academic_setup, NOT coalesce(v_onboarding_finalizado, false)),
      'completion_percent', v_completion_percent,
      'next_action', v_next_action,
      'blockers', coalesce(v_readiness->'blockers', '[]'::jsonb),
      'badges', v_badges
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_onboarding_public_handoff(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_onboarding_public_handoff(text) TO anon, authenticated, service_role;

COMMIT;
