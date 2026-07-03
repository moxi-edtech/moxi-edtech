BEGIN;

CREATE OR REPLACE FUNCTION public.onboarding_step_sort_order(p_step_code text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE coalesce(trim(p_step_code), '')
    WHEN 'diagnostico' THEN 1
    WHEN 'planilhas' THEN 2
    WHEN 'validacao' THEN 3
    WHEN 'config' THEN 4
    WHEN 'treinamento' THEN 5
    WHEN 'live' THEN 6
    ELSE 999
  END
$$;

CREATE OR REPLACE FUNCTION public.seed_onboarding_steps_v2(
  p_onboarding_id uuid,
  p_created_at timestamptz,
  p_request_status text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_created_at timestamptz := coalesce(p_created_at, now());
  v_request_status text := coalesce(p_request_status, 'pendente');
  v_crm_lead_id uuid;
  v_planilhas public.onboarding_steps%ROWTYPE;
  v_treinamento public.onboarding_steps%ROWTYPE;
  v_ativacao public.onboarding_steps%ROWTYPE;
  v_has_planilhas_upload boolean := false;
  v_has_live_upload boolean := false;
  v_first_progress_at timestamptz := NULL;
  v_has_progress boolean := false;
  v_has_validation_inputs boolean := false;
  v_diag_status text := 'pendente';
  v_diag_completed_at timestamptz := NULL;
  v_plan_status text := 'pendente';
  v_plan_completed_at timestamptz := NULL;
  v_validacao_status text := 'pendente';
  v_validacao_completed_at timestamptz := NULL;
  v_config_status text := 'pendente';
  v_config_completed_at timestamptz := NULL;
  v_treinamento_status text := 'pendente';
  v_treinamento_completed_at timestamptz := NULL;
  v_live_status text := 'pendente';
  v_live_completed_at timestamptz := NULL;
BEGIN
  SELECT crm_lead_id
    INTO v_crm_lead_id
  FROM public.onboarding_requests
  WHERE id = p_onboarding_id;

  SELECT *
    INTO v_planilhas
  FROM public.onboarding_steps
  WHERE onboarding_id = p_onboarding_id
    AND step_code = 'planilhas'
  LIMIT 1;

  SELECT *
    INTO v_treinamento
  FROM public.onboarding_steps
  WHERE onboarding_id = p_onboarding_id
    AND step_code = 'treinamento'
  LIMIT 1;

  SELECT *
    INTO v_ativacao
  FROM public.onboarding_steps
  WHERE onboarding_id = p_onboarding_id
    AND step_code = 'live'
  LIMIT 1;

  SELECT
    bool_or(step_code = 'planilhas') FILTER (WHERE step_code = 'planilhas'),
    bool_or(step_code = 'live') FILTER (WHERE step_code = 'live'),
    min(created_at)
    INTO v_has_planilhas_upload, v_has_live_upload, v_first_progress_at
  FROM public.onboarding_uploads
  WHERE onboarding_id = p_onboarding_id
    AND step_code IN ('planilhas', 'live');

  v_has_progress := (
    v_request_status = 'activo'
    OR v_crm_lead_id IS NOT NULL
    OR coalesce(v_has_planilhas_upload, false)
    OR coalesce(v_has_live_upload, false)
    OR coalesce(v_planilhas.status, 'pendente') <> 'pendente'
    OR coalesce(v_treinamento.status, 'pendente') <> 'pendente'
    OR coalesce(v_ativacao.status, 'pendente') <> 'pendente'
  );

  v_has_validation_inputs := (
    coalesce(v_has_planilhas_upload, false)
    OR coalesce(v_planilhas.status, 'pendente') <> 'pendente'
  );

  IF v_request_status = 'activo' THEN
    v_diag_status := 'concluido';
    v_plan_status := 'concluido';
    v_validacao_status := 'concluido';
    v_config_status := 'concluido';
    v_treinamento_status := 'concluido';
    v_live_status := 'concluido';

    v_diag_completed_at := coalesce(v_planilhas.completed_at, v_treinamento.completed_at, v_ativacao.completed_at, v_first_progress_at, v_created_at);
    v_plan_completed_at := coalesce(v_planilhas.completed_at, v_first_progress_at, v_created_at);
    v_validacao_completed_at := coalesce(v_plan_completed_at, v_first_progress_at, v_created_at);
    v_config_completed_at := coalesce(v_treinamento.completed_at, v_ativacao.completed_at, v_created_at);
    v_treinamento_completed_at := coalesce(v_treinamento.completed_at, v_config_completed_at, v_created_at);
    v_live_completed_at := coalesce(v_ativacao.completed_at, v_treinamento.completed_at, v_first_progress_at, v_created_at);
  ELSE
    IF v_has_progress THEN
      v_diag_status := 'concluido';
      v_diag_completed_at := coalesce(v_planilhas.completed_at, v_first_progress_at, v_created_at);
    END IF;

    IF v_planilhas.id IS NOT NULL THEN
      v_plan_status := v_planilhas.status;
      v_plan_completed_at := v_planilhas.completed_at;
    END IF;

    IF v_plan_status = 'concluido' THEN
      v_validacao_status := 'concluido';
      v_validacao_completed_at := coalesce(v_plan_completed_at, v_first_progress_at, v_created_at);
    ELSIF v_has_validation_inputs THEN
      v_validacao_status := 'em_progresso';
    END IF;

    IF v_treinamento.id IS NOT NULL THEN
      v_treinamento_status := v_treinamento.status;
      v_treinamento_completed_at := v_treinamento.completed_at;
    END IF;

    IF v_ativacao.id IS NOT NULL THEN
      v_live_status := v_ativacao.status;
      v_live_completed_at := v_ativacao.completed_at;
    END IF;

    IF v_treinamento.status = 'concluido' OR v_ativacao.status = 'concluido' THEN
      v_config_status := 'concluido';
      v_config_completed_at := coalesce(v_treinamento.completed_at, v_ativacao.completed_at, v_created_at);
    ELSIF v_treinamento.status = 'em_progresso' OR v_ativacao.status = 'em_progresso' THEN
      v_config_status := 'em_progresso';
    END IF;
  END IF;

  -- Delete docs_legais step if it exists
  DELETE FROM public.onboarding_steps
  WHERE onboarding_id = p_onboarding_id
    AND step_code = 'docs_legais';

  INSERT INTO public.onboarding_steps (onboarding_id, step_code, title, status, owner_type, sla_days, deadline_at, completed_at)
  VALUES
    (p_onboarding_id, 'diagnostico', 'Diagnóstico inicial da escola', v_diag_status, 'parceiro', 3, v_created_at + interval '3 days', v_diag_completed_at),
    (p_onboarding_id, 'planilhas', 'Upload de planilhas operacionais', v_plan_status, 'escola', 5, v_created_at + interval '8 days', v_plan_completed_at),
    (p_onboarding_id, 'validacao', 'Validação técnica de dados', v_validacao_status, 'klasse', 2, v_created_at + interval '10 days', v_validacao_completed_at),
    (p_onboarding_id, 'config', 'Configuração operacional da escola', v_config_status, 'parceiro', 2, v_created_at + interval '12 days', v_config_completed_at),
    (p_onboarding_id, 'treinamento', 'Treinamento da equipa escolar', v_treinamento_status, 'parceiro', 3, v_created_at + interval '15 days', v_treinamento_completed_at),
    (p_onboarding_id, 'live', 'Go-live e abertura oficial', v_live_status, 'klasse', 1, v_created_at + interval '16 days', v_live_completed_at)
  ON CONFLICT (onboarding_id, step_code) DO UPDATE
  SET
    title = EXCLUDED.title,
    owner_type = EXCLUDED.owner_type,
    sla_days = EXCLUDED.sla_days,
    deadline_at = EXCLUDED.deadline_at,
    status = EXCLUDED.status,
    completed_at = EXCLUDED.completed_at,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_afiliado_member_portal(
  p_codigo text,
  p_member_id uuid,
  p_pin text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog, pg_temp
AS $$
DECLARE
  v_codigo text;
  v_nome text;
  v_materiais jsonb;
  v_member_nome text;
  v_result jsonb;
  v_trend jsonb;
  v_onboarding jsonb;
BEGIN
  v_codigo := upper(trim(coalesce(p_codigo, '')));

  SELECT
    a.codigo,
    a.nome,
    a.materiais_json,
    m.nome
    INTO v_codigo, v_nome, v_materiais, v_member_nome
  FROM public.afiliados a
  JOIN public.afiliado_membros m
    ON m.afiliado_id = a.id
  WHERE a.codigo = v_codigo
    AND a.ativo = true
    AND m.id = p_member_id
    AND m.ativo = true
    AND m.pin_hash = extensions.crypt(coalesce(p_pin, ''), m.pin_hash)
  LIMIT 1;

  IF v_codigo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_credentials');
  END IF;

  WITH dias AS (
    SELECT generate_series(
      CURRENT_DATE - INTERVAL '6 days',
      CURRENT_DATE,
      INTERVAL '1 day'
    )::date AS dia
  ),
  metricas_diarias AS (
    SELECT
      d.dia,
      count(l.id) FILTER (WHERE l.etapa = 'ganho') AS escolas_ganhas,
      count(l.id) FILTER (WHERE l.etapa <> 'ganho' AND l.etapa <> 'perdido') AS leads_ativos
    FROM dias d
    LEFT JOIN public.crm_leads l
      ON l.membro_id = p_member_id
      AND l.created_at::date <= d.dia
      AND (l.deleted_at IS NULL OR l.deleted_at::date > d.dia)
    GROUP BY d.dia
    ORDER BY d.dia ASC
  )
  SELECT jsonb_build_object(
    'historico', jsonb_agg(
      jsonb_build_object(
        'data', dia,
        'escolas_ganhas', escolas_ganhas,
        'leads_ativos', leads_ativos
      )
    )
  ) INTO v_trend
  FROM metricas_diarias;

  SELECT jsonb_build_object(
    'recentes', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', recent.id,
          'created_at', recent.created_at,
          'status', recent.status,
          'escola_nome', recent.escola_nome,
          'escola_id', recent.escola_id,
          'nif', recent.nif,
          'plano', recent.plano,
          'curriculum_preset', recent.curriculum_preset,
          'niveis_ensino', recent.niveis_ensino,
          'contacto_secretaria', recent.contacto_secretaria,
          'contacto_financeiro', recent.contacto_financeiro,
          'contacto_pedagogico', recent.contacto_pedagogico,
          'aceite_comercial_at', recent.aceite_comercial_at,
          'checklist', recent.checklist,
          'checklist_updated_at', recent.checklist_updated_at,
          'checklist_updated_by', recent.checklist_updated_by,
          'responsavel_nome', recent.responsavel_nome,
          'uploads', coalesce((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', up.id,
                'step_code', up.step_code,
                'file_name', up.file_name,
                'file_type', up.file_type,
                'status', up.status,
                'rejection_reason', up.rejection_reason,
                'created_at', up.created_at
              )
              ORDER BY up.created_at DESC
            )
            FROM public.onboarding_uploads up
            WHERE up.onboarding_id = recent.id
          ), '[]'::jsonb),
          'steps', coalesce((
            SELECT jsonb_agg(
              jsonb_build_object(
                'code', s.step_code,
                'title', s.title,
                'status', s.status,
                'owner', s.owner_type,
                'deadline', s.deadline_at,
                'completed_at', s.completed_at
              )
              ORDER BY coalesce(array_position(ARRAY['diagnostico', 'planilhas', 'validacao', 'config', 'treinamento', 'live']::text[], s.step_code), 999), s.created_at ASC
            )
            FROM public.onboarding_steps s
            WHERE s.onboarding_id = recent.id
          ), '[]'::jsonb)
        )
        ORDER BY recent.created_at DESC
      ), '[]'::jsonb
    )
  ) INTO v_onboarding
  FROM (
    SELECT
      r.id,
      r.created_at,
      r.status,
      r.escola_nome,
      r.escola_id,
      r.nif,
      r.plano,
      r.curriculum_preset,
      r.niveis_ensino,
      r.contacto_secretaria,
      r.contacto_financeiro,
      r.contacto_pedagogico,
      r.aceite_comercial_at,
      r.checklist,
      r.checklist_updated_at,
      r.checklist_updated_by,
      m.nome AS responsavel_nome
    FROM public.onboarding_requests r
    LEFT JOIN public.afiliado_membros m
      ON m.id = r.responsavel_membro_id
    WHERE r.membro_id = p_member_id
    ORDER BY r.created_at DESC
    LIMIT 25
  ) recent;

  SELECT jsonb_build_object(
    'codigo', v_codigo,
    'nome', v_nome,
    'member_nome', v_member_nome,
    'materiais', v_materiais,
    'trend', v_trend,
    'onboarding', v_onboarding
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Trigger a workflow update on all active onboarding requests to apply the new order, remove docs_legais, and unblock validation
DO $$
DECLARE
  v_req record;
BEGIN
  FOR v_req IN SELECT id, created_at, status FROM public.onboarding_requests LOOP
    DELETE FROM public.onboarding_steps WHERE onboarding_id = v_req.id AND step_code = 'docs_legais';
    PERFORM public.seed_onboarding_steps_v2(v_req.id, v_req.created_at, v_req.status);
  END LOOP;
END;
$$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES
  ('20270703130000', '20270703130000_bypass_legal_documents_blocking_onboarding.sql')
ON CONFLICT (version) DO NOTHING;

COMMIT;
