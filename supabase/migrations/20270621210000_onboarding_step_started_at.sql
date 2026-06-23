BEGIN;

ALTER TABLE public.onboarding_steps
  ADD COLUMN IF NOT EXISTS started_at timestamptz;

WITH ranked_steps AS (
  SELECT
    s.id,
    s.onboarding_id,
    s.step_code,
    s.status,
    s.created_at,
    s.completed_at,
    lag(s.completed_at) OVER (
      PARTITION BY s.onboarding_id
      ORDER BY public.onboarding_step_sort_order(s.step_code), s.created_at, s.id
    ) AS prev_completed_at
  FROM public.onboarding_steps s
)
UPDATE public.onboarding_steps target
SET started_at = CASE
  WHEN ranked_steps.status = 'pendente' THEN NULL
  ELSE coalesce(ranked_steps.prev_completed_at, ranked_steps.created_at)
END
FROM ranked_steps
WHERE target.id = ranked_steps.id
  AND target.started_at IS NULL;

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
  v_nif public.onboarding_steps%ROWTYPE;
  v_planilhas public.onboarding_steps%ROWTYPE;
  v_treinamento public.onboarding_steps%ROWTYPE;
  v_ativacao public.onboarding_steps%ROWTYPE;
  v_has_progress boolean := false;
  v_diag_status text := 'pendente';
  v_diag_started_at timestamptz := NULL;
  v_diag_completed_at timestamptz := NULL;
  v_docs_status text := 'pendente';
  v_docs_started_at timestamptz := NULL;
  v_docs_completed_at timestamptz := NULL;
  v_plan_status text := 'pendente';
  v_plan_started_at timestamptz := NULL;
  v_plan_completed_at timestamptz := NULL;
  v_validacao_status text := 'pendente';
  v_validacao_started_at timestamptz := NULL;
  v_validacao_completed_at timestamptz := NULL;
  v_config_status text := 'pendente';
  v_config_started_at timestamptz := NULL;
  v_config_completed_at timestamptz := NULL;
  v_treinamento_status text := 'pendente';
  v_treinamento_started_at timestamptz := NULL;
  v_treinamento_completed_at timestamptz := NULL;
  v_live_status text := 'pendente';
  v_live_started_at timestamptz := NULL;
  v_live_completed_at timestamptz := NULL;
BEGIN
  SELECT * INTO v_nif
  FROM public.onboarding_steps
  WHERE onboarding_id = p_onboarding_id
    AND step_code = 'nif'
  LIMIT 1;

  SELECT * INTO v_planilhas
  FROM public.onboarding_steps
  WHERE onboarding_id = p_onboarding_id
    AND step_code = 'planilha_alunos'
  LIMIT 1;

  SELECT * INTO v_treinamento
  FROM public.onboarding_steps
  WHERE onboarding_id = p_onboarding_id
    AND step_code = 'treinamento'
  LIMIT 1;

  SELECT * INTO v_ativacao
  FROM public.onboarding_steps
  WHERE onboarding_id = p_onboarding_id
    AND step_code = 'ativacao'
  LIMIT 1;

  v_has_progress := (
    v_request_status = 'activo'
    OR coalesce(v_nif.status, 'pendente') <> 'pendente'
    OR coalesce(v_planilhas.status, 'pendente') <> 'pendente'
    OR coalesce(v_treinamento.status, 'pendente') <> 'pendente'
    OR coalesce(v_ativacao.status, 'pendente') <> 'pendente'
  );

  IF v_request_status = 'activo' THEN
    v_diag_status := 'concluido';
    v_diag_started_at := v_created_at;
    v_docs_status := 'concluido';
    v_docs_started_at := coalesce(v_nif.started_at, v_diag_completed_at, v_created_at);
    v_plan_status := 'concluido';
    v_validacao_status := 'concluido';
    v_config_status := 'concluido';
    v_treinamento_status := 'concluido';
    v_live_status := 'concluido';

    v_diag_completed_at := coalesce(v_nif.completed_at, v_planilhas.completed_at, v_treinamento.completed_at, v_ativacao.completed_at, v_created_at);
    v_docs_completed_at := coalesce(v_nif.completed_at, v_created_at);
    v_plan_started_at := coalesce(v_planilhas.started_at, v_docs_completed_at, v_docs_started_at, v_created_at);
    v_plan_completed_at := coalesce(v_planilhas.completed_at, v_docs_completed_at, v_created_at);
    v_validacao_started_at := coalesce(v_nif.started_at, v_plan_completed_at, v_plan_started_at, v_created_at);
    v_validacao_completed_at := coalesce(v_nif.completed_at, v_docs_completed_at, v_created_at);
    v_config_started_at := coalesce(v_treinamento.started_at, v_validacao_completed_at, v_validacao_started_at, v_created_at);
    v_config_completed_at := coalesce(v_treinamento.completed_at, v_ativacao.completed_at, v_created_at);
    v_treinamento_started_at := coalesce(v_treinamento.started_at, v_config_completed_at, v_config_started_at, v_created_at);
    v_treinamento_completed_at := coalesce(v_treinamento.completed_at, v_config_completed_at, v_created_at);
    v_live_started_at := coalesce(v_ativacao.started_at, v_treinamento_completed_at, v_treinamento_started_at, v_created_at);
    v_live_completed_at := coalesce(v_ativacao.completed_at, v_treinamento.completed_at, v_created_at);
  ELSE
    IF v_has_progress THEN
      v_diag_status := 'concluido';
      v_diag_started_at := v_created_at;
      v_diag_completed_at := coalesce(v_nif.completed_at, v_planilhas.completed_at, v_created_at);
    END IF;

    IF v_nif.id IS NOT NULL THEN
      IF v_nif.status = 'concluido' THEN
        v_docs_status := 'concluido';
        v_validacao_status := 'concluido';
        v_docs_started_at := coalesce(v_nif.started_at, v_diag_completed_at, v_created_at);
        v_validacao_started_at := coalesce(v_nif.started_at, v_docs_completed_at, v_docs_started_at, v_created_at);
        v_docs_completed_at := coalesce(v_nif.completed_at, v_created_at);
        v_validacao_completed_at := coalesce(v_nif.completed_at, v_docs_completed_at, v_created_at);
      ELSIF v_nif.status = 'em_progresso' THEN
        v_docs_status := 'em_progresso';
        v_docs_started_at := coalesce(v_nif.started_at, v_diag_completed_at, v_created_at);
      END IF;
    END IF;

    IF v_planilhas.id IS NOT NULL THEN
      v_plan_status := v_planilhas.status;
      v_plan_started_at := coalesce(v_planilhas.started_at, v_docs_completed_at, v_docs_started_at, v_created_at);
      v_plan_completed_at := v_planilhas.completed_at;
    END IF;

    IF v_treinamento.id IS NOT NULL THEN
      v_treinamento_status := v_treinamento.status;
      v_treinamento_started_at := coalesce(v_treinamento.started_at, v_config_completed_at, v_config_started_at, v_created_at);
      v_treinamento_completed_at := v_treinamento.completed_at;
    END IF;

    IF v_ativacao.id IS NOT NULL THEN
      v_live_status := v_ativacao.status;
      v_live_started_at := coalesce(v_ativacao.started_at, v_treinamento_completed_at, v_treinamento_started_at, v_created_at);
      v_live_completed_at := v_ativacao.completed_at;
    END IF;

    IF v_treinamento.status = 'concluido' OR v_ativacao.status = 'concluido' THEN
      v_config_status := 'concluido';
      v_config_started_at := coalesce(v_treinamento.started_at, v_validacao_completed_at, v_validacao_started_at, v_created_at);
      v_config_completed_at := coalesce(v_treinamento.completed_at, v_ativacao.completed_at, v_created_at);
    ELSIF v_treinamento.status = 'em_progresso' OR v_ativacao.status = 'em_progresso' THEN
      v_config_status := 'em_progresso';
      v_config_started_at := coalesce(v_treinamento.started_at, v_validacao_completed_at, v_validacao_started_at, v_created_at);
    END IF;
  END IF;

  INSERT INTO public.onboarding_steps (onboarding_id, step_code, title, status, owner_type, sla_days, deadline_at, started_at, completed_at)
  VALUES
    (p_onboarding_id, 'diagnostico', 'Diagnóstico inicial da escola', v_diag_status, 'parceiro', 3, v_created_at + interval '3 days', v_diag_started_at, v_diag_completed_at),
    (p_onboarding_id, 'docs_legais', 'Envio de documentos legais', v_docs_status, 'escola', 3, v_created_at + interval '6 days', v_docs_started_at, v_docs_completed_at),
    (p_onboarding_id, 'planilhas', 'Upload de planilhas operacionais', v_plan_status, 'escola', 5, v_created_at + interval '11 days', v_plan_started_at, v_plan_completed_at),
    (p_onboarding_id, 'validacao', 'Validação técnica de dados', v_validacao_status, 'klasse', 2, v_created_at + interval '13 days', v_validacao_started_at, v_validacao_completed_at),
    (p_onboarding_id, 'config', 'Configuração operacional da escola', v_config_status, 'parceiro', 2, v_created_at + interval '15 days', v_config_started_at, v_config_completed_at),
    (p_onboarding_id, 'treinamento', 'Treinamento da equipa escolar', v_treinamento_status, 'parceiro', 3, v_created_at + interval '18 days', v_treinamento_started_at, v_treinamento_completed_at),
    (p_onboarding_id, 'live', 'Go-live e abertura oficial', v_live_status, 'klasse', 1, v_created_at + interval '19 days', v_live_started_at, v_live_completed_at)
  ON CONFLICT (onboarding_id, step_code) DO UPDATE
  SET
    title = EXCLUDED.title,
    owner_type = EXCLUDED.owner_type,
    sla_days = EXCLUDED.sla_days,
    deadline_at = EXCLUDED.deadline_at,
    status = EXCLUDED.status,
    started_at = EXCLUDED.started_at,
    completed_at = EXCLUDED.completed_at,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.create_onboarding_upload_by_token(
  p_token text,
  p_step_code text,
  p_file_path text,
  p_created_by text,
  p_criado_por_membro_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_request public.onboarding_requests%ROWTYPE;
  v_step public.onboarding_steps%ROWTYPE;
  v_upload public.onboarding_uploads%ROWTYPE;
  v_member public.afiliado_membros%ROWTYPE;
  v_influencer_codigo text;
BEGIN
  SELECT *
    INTO v_request
  FROM public.onboarding_requests
  WHERE tracking_token = upper(trim(coalesce(p_token, '')))
  LIMIT 1;

  IF v_request.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Onboarding não encontrado.');
  END IF;

  SELECT *
    INTO v_step
  FROM public.onboarding_steps
  WHERE onboarding_id = v_request.id
    AND step_code = trim(coalesce(p_step_code, ''))
  LIMIT 1;

  IF v_step.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Etapa de onboarding não encontrada.');
  END IF;

  IF p_created_by NOT IN ('escola', 'parceiro') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Origem do upload inválida.');
  END IF;

  IF p_created_by = 'parceiro' THEN
    IF p_criado_por_membro_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Membro do parceiro é obrigatório para este upload.');
    END IF;

    v_influencer_codigo := upper(coalesce(v_request.financeiro->>'influencer_codigo', ''));
    IF v_influencer_codigo = '' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Onboarding sem parceiro associado.');
    END IF;

    SELECT m.*
      INTO v_member
    FROM public.afiliado_membros m
    JOIN public.afiliados a
      ON a.id = m.afiliado_id
    WHERE m.id = p_criado_por_membro_id
      AND m.ativo = true
      AND a.ativo = true
      AND a.codigo = v_influencer_codigo
    LIMIT 1;

    IF v_member.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Membro do parceiro inválido para este onboarding.');
    END IF;
  ELSE
    p_criado_por_membro_id := NULL;
  END IF;

  INSERT INTO public.onboarding_uploads (
    onboarding_id,
    step_code,
    file_path,
    status,
    created_by,
    criado_por_membro_id
  )
  VALUES (
    v_request.id,
    trim(coalesce(p_step_code, '')),
    p_file_path,
    'pendente',
    p_created_by,
    p_criado_por_membro_id
  )
  RETURNING *
    INTO v_upload;

  IF v_step.status = 'pendente' THEN
    UPDATE public.onboarding_steps
    SET status = 'em_progresso',
        started_at = coalesce(started_at, now()),
        updated_at = now()
    WHERE id = v_step.id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'upload', to_jsonb(v_upload));
END;
$$;

COMMIT;
