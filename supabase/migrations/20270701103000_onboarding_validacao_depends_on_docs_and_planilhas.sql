BEGIN;

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
  v_nif public.onboarding_steps%ROWTYPE;
  v_planilhas public.onboarding_steps%ROWTYPE;
  v_treinamento public.onboarding_steps%ROWTYPE;
  v_ativacao public.onboarding_steps%ROWTYPE;
  v_has_docs_upload boolean := false;
  v_has_planilhas_upload boolean := false;
  v_has_live_upload boolean := false;
  v_first_progress_at timestamptz := NULL;
  v_has_progress boolean := false;
  v_has_validation_inputs boolean := false;
  v_diag_status text := 'pendente';
  v_diag_completed_at timestamptz := NULL;
  v_docs_status text := 'pendente';
  v_docs_completed_at timestamptz := NULL;
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
    INTO v_nif
  FROM public.onboarding_steps
  WHERE onboarding_id = p_onboarding_id
    AND step_code = 'docs_legais'
  LIMIT 1;

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
    bool_or(step_code = 'docs_legais') FILTER (WHERE step_code = 'docs_legais'),
    bool_or(step_code = 'planilhas') FILTER (WHERE step_code = 'planilhas'),
    bool_or(step_code = 'live') FILTER (WHERE step_code = 'live'),
    min(created_at)
    INTO v_has_docs_upload, v_has_planilhas_upload, v_has_live_upload, v_first_progress_at
  FROM public.onboarding_uploads
  WHERE onboarding_id = p_onboarding_id
    AND step_code IN ('docs_legais', 'planilhas', 'live');

  v_has_progress := (
    v_request_status = 'activo'
    OR v_crm_lead_id IS NOT NULL
    OR coalesce(v_has_docs_upload, false)
    OR coalesce(v_has_planilhas_upload, false)
    OR coalesce(v_has_live_upload, false)
    OR coalesce(v_nif.status, 'pendente') <> 'pendente'
    OR coalesce(v_planilhas.status, 'pendente') <> 'pendente'
    OR coalesce(v_treinamento.status, 'pendente') <> 'pendente'
    OR coalesce(v_ativacao.status, 'pendente') <> 'pendente'
  );

  v_has_validation_inputs := (
    coalesce(v_has_docs_upload, false)
    OR coalesce(v_has_planilhas_upload, false)
    OR coalesce(v_nif.status, 'pendente') <> 'pendente'
    OR coalesce(v_planilhas.status, 'pendente') <> 'pendente'
  );

  IF v_request_status = 'activo' THEN
    v_diag_status := 'concluido';
    v_docs_status := 'concluido';
    v_plan_status := 'concluido';
    v_validacao_status := 'concluido';
    v_config_status := 'concluido';
    v_treinamento_status := 'concluido';
    v_live_status := 'concluido';

    v_diag_completed_at := coalesce(v_nif.completed_at, v_planilhas.completed_at, v_treinamento.completed_at, v_ativacao.completed_at, v_first_progress_at, v_created_at);
    v_docs_completed_at := coalesce(v_nif.completed_at, v_first_progress_at, v_created_at);
    v_plan_completed_at := coalesce(v_planilhas.completed_at, v_docs_completed_at, v_first_progress_at, v_created_at);
    v_validacao_completed_at := coalesce(v_planilhas.completed_at, v_nif.completed_at, v_docs_completed_at, v_first_progress_at, v_created_at);
    v_config_completed_at := coalesce(v_treinamento.completed_at, v_ativacao.completed_at, v_created_at);
    v_treinamento_completed_at := coalesce(v_treinamento.completed_at, v_config_completed_at, v_created_at);
    v_live_completed_at := coalesce(v_ativacao.completed_at, v_treinamento.completed_at, v_first_progress_at, v_created_at);
  ELSE
    IF v_has_progress THEN
      v_diag_status := 'concluido';
      v_diag_completed_at := coalesce(v_nif.completed_at, v_planilhas.completed_at, v_first_progress_at, v_created_at);
    END IF;

    IF v_nif.id IS NOT NULL THEN
      IF v_nif.status = 'concluido' THEN
        v_docs_status := 'concluido';
        v_docs_completed_at := coalesce(v_nif.completed_at, v_first_progress_at, v_created_at);
      ELSIF v_nif.status = 'em_progresso' THEN
        v_docs_status := 'em_progresso';
      END IF;
    END IF;

    IF v_planilhas.id IS NOT NULL THEN
      v_plan_status := v_planilhas.status;
      v_plan_completed_at := v_planilhas.completed_at;
    END IF;

    IF v_docs_status = 'concluido' AND v_plan_status = 'concluido' THEN
      v_validacao_status := 'concluido';
      v_validacao_completed_at := coalesce(v_plan_completed_at, v_docs_completed_at, v_first_progress_at, v_created_at);
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

  INSERT INTO public.onboarding_steps (onboarding_id, step_code, title, status, owner_type, sla_days, deadline_at, completed_at)
  VALUES
    (p_onboarding_id, 'diagnostico', 'Diagnóstico inicial da escola', v_diag_status, 'parceiro', 3, v_created_at + interval '3 days', v_diag_completed_at),
    (p_onboarding_id, 'docs_legais', 'Envio de documentos legais', v_docs_status, 'escola', 3, v_created_at + interval '6 days', v_docs_completed_at),
    (p_onboarding_id, 'planilhas', 'Upload de planilhas operacionais', v_plan_status, 'escola', 5, v_created_at + interval '11 days', v_plan_completed_at),
    (p_onboarding_id, 'validacao', 'Validação técnica de dados', v_validacao_status, 'klasse', 2, v_created_at + interval '13 days', v_validacao_completed_at),
    (p_onboarding_id, 'config', 'Configuração operacional da escola', v_config_status, 'parceiro', 2, v_created_at + interval '15 days', v_config_completed_at),
    (p_onboarding_id, 'treinamento', 'Treinamento da equipa escolar', v_treinamento_status, 'parceiro', 3, v_created_at + interval '18 days', v_treinamento_completed_at),
    (p_onboarding_id, 'live', 'Go-live e abertura oficial', v_live_status, 'klasse', 1, v_created_at + interval '19 days', v_live_completed_at)
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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES
  ('20270630160000', '20270630160000_onboarding_workflow_sync_after_uploads.sql'),
  ('20270701103000', '20270701103000_onboarding_validacao_depends_on_docs_and_planilhas.sql')
ON CONFLICT (version) DO NOTHING;

COMMIT;
