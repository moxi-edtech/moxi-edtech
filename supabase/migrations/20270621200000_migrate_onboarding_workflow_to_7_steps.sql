BEGIN;

CREATE OR REPLACE FUNCTION public.onboarding_step_sort_order(p_step_code text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE coalesce(trim(p_step_code), '')
    WHEN 'diagnostico' THEN 1
    WHEN 'docs_legais' THEN 2
    WHEN 'planilhas' THEN 3
    WHEN 'validacao' THEN 4
    WHEN 'config' THEN 5
    WHEN 'treinamento' THEN 6
    WHEN 'live' THEN 7
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
  v_nif public.onboarding_steps%ROWTYPE;
  v_planilhas public.onboarding_steps%ROWTYPE;
  v_treinamento public.onboarding_steps%ROWTYPE;
  v_ativacao public.onboarding_steps%ROWTYPE;
  v_has_progress boolean := false;
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
    v_docs_status := 'concluido';
    v_plan_status := 'concluido';
    v_validacao_status := 'concluido';
    v_config_status := 'concluido';
    v_treinamento_status := 'concluido';
    v_live_status := 'concluido';

    v_diag_completed_at := coalesce(v_nif.completed_at, v_planilhas.completed_at, v_treinamento.completed_at, v_ativacao.completed_at, v_created_at);
    v_docs_completed_at := coalesce(v_nif.completed_at, v_created_at);
    v_plan_completed_at := coalesce(v_planilhas.completed_at, v_docs_completed_at, v_created_at);
    v_validacao_completed_at := coalesce(v_nif.completed_at, v_docs_completed_at, v_created_at);
    v_config_completed_at := coalesce(v_treinamento.completed_at, v_ativacao.completed_at, v_created_at);
    v_treinamento_completed_at := coalesce(v_treinamento.completed_at, v_config_completed_at, v_created_at);
    v_live_completed_at := coalesce(v_ativacao.completed_at, v_treinamento.completed_at, v_created_at);
  ELSE
    IF v_has_progress THEN
      v_diag_status := 'concluido';
      v_diag_completed_at := coalesce(v_nif.completed_at, v_planilhas.completed_at, v_created_at);
    END IF;

    IF v_nif.id IS NOT NULL THEN
      IF v_nif.status = 'concluido' THEN
        v_docs_status := 'concluido';
        v_validacao_status := 'concluido';
        v_docs_completed_at := coalesce(v_nif.completed_at, v_created_at);
        v_validacao_completed_at := coalesce(v_nif.completed_at, v_docs_completed_at, v_created_at);
      ELSIF v_nif.status = 'em_progresso' THEN
        v_docs_status := 'em_progresso';
      END IF;
    END IF;

    IF v_planilhas.id IS NOT NULL THEN
      v_plan_status := v_planilhas.status;
      v_plan_completed_at := v_planilhas.completed_at;
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

UPDATE public.onboarding_uploads
SET step_code = CASE step_code
  WHEN 'nif' THEN 'docs_legais'
  WHEN 'planilha_alunos' THEN 'planilhas'
  WHEN 'ativacao' THEN 'live'
  ELSE step_code
END
WHERE step_code IN ('nif', 'planilha_alunos', 'ativacao');

DO $$
DECLARE
  v_request record;
BEGIN
  FOR v_request IN
    SELECT id, created_at, status
    FROM public.onboarding_requests
  LOOP
    PERFORM public.seed_onboarding_steps_v2(v_request.id, v_request.created_at, v_request.status);
  END LOOP;
END $$;

DELETE FROM public.onboarding_steps
WHERE step_code IN ('nif', 'planilha_alunos', 'ativacao');

CREATE OR REPLACE FUNCTION public.handle_onboarding_request_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
BEGIN
  PERFORM public.seed_onboarding_steps_v2(NEW.id, NEW.created_at, NEW.status);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_onboarding_tracking_payload(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_request public.onboarding_requests%ROWTYPE;
  v_steps jsonb;
  v_uploads jsonb;
BEGIN
  SELECT *
    INTO v_request
  FROM public.onboarding_requests
  WHERE tracking_token = upper(trim(coalesce(p_token, '')))
  LIMIT 1;

  IF v_request.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pedido não encontrado');
  END IF;

  SELECT coalesce(
    jsonb_agg(to_jsonb(s) ORDER BY public.onboarding_step_sort_order(s.step_code), s.created_at ASC),
    '[]'::jsonb
  )
    INTO v_steps
  FROM public.onboarding_steps s
  WHERE s.onboarding_id = v_request.id;

  SELECT coalesce(
    jsonb_agg(to_jsonb(u) ORDER BY u.created_at DESC),
    '[]'::jsonb
  )
    INTO v_uploads
  FROM public.onboarding_uploads u
  WHERE u.onboarding_id = v_request.id;

  RETURN jsonb_build_object(
    'ok', true,
    'request', to_jsonb(v_request),
    'steps', v_steps,
    'uploads', v_uploads
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_afiliado_portal(p_codigo text, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog, pg_temp
AS $$
DECLARE
  v_codigo text;
  v_nome text;
  v_materiais jsonb;
  v_result jsonb;
  v_trend jsonb;
  v_onboarding jsonb;
BEGIN
  v_codigo := upper(trim(coalesce(p_codigo, '')));

  SELECT a.codigo, a.nome, a.materiais_json
    INTO v_codigo, v_nome, v_materiais
  FROM public.afiliados a
  WHERE a.codigo = v_codigo
    AND a.ativo = true
    AND a.pin_hash = extensions.crypt(coalesce(p_pin, ''), a.pin_hash)
  LIMIT 1;

  IF v_codigo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_credentials');
  END IF;

  WITH dias AS (
    SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day')::date AS dia
  ),
  counts AS (
    SELECT ml.created_at::date AS dia, count(*) AS total
    FROM public.marketing_leads ml
    WHERE upper(ml.afiliado_codigo) = v_codigo
      AND ml.created_at >= CURRENT_DATE - INTERVAL '6 days'
    GROUP BY 1
  )
  SELECT jsonb_agg(
    jsonb_build_object('dia', to_char(d.dia, 'DD/MM'), 'total', coalesce(c.total, 0))
    ORDER BY d.dia ASC
  ) INTO v_trend
  FROM dias d
  LEFT JOIN counts c ON d.dia = c.dia;

  SELECT jsonb_build_object(
    'total', count(*),
    'pendentes', count(*) FILTER (WHERE obr.status = 'pendente'),
    'em_configuracao', count(*) FILTER (WHERE obr.status = 'em_configuracao'),
    'fechadas', count(*) FILTER (WHERE obr.status = 'activo'),
    'escolas', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'data', recent.created_at,
          'status', recent.status,
          'escola', recent.escola_nome,
          'plano', recent.financeiro->>'plano_interesse',
          'plano_label', recent.financeiro->>'plano_interesse_label',
          'total_alunos', recent.financeiro->>'total_alunos',
          'token', recent.tracking_token,
          'faixa_propina', recent.faixa_propina,
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
              ORDER BY public.onboarding_step_sort_order(s.step_code), s.created_at ASC
            )
            FROM public.onboarding_steps s
            WHERE s.onboarding_id = recent.id
          ), '[]'::jsonb)
        )
        ORDER BY recent.created_at DESC
      )
      FROM (
        SELECT id, created_at, status, escola_nome, financeiro, tracking_token, faixa_propina
        FROM public.onboarding_requests
        WHERE upper(coalesce(financeiro->>'influencer_codigo', '')) = v_codigo
        ORDER BY created_at DESC
        LIMIT 50
      ) recent
    ), '[]'::jsonb)
  )
  INTO v_onboarding
  FROM public.onboarding_requests obr
  WHERE upper(coalesce(obr.financeiro->>'influencer_codigo', '')) = v_codigo;

  SELECT jsonb_build_object(
    'ok', true,
    'codigo', v_codigo,
    'nome', coalesce(v_nome, v_codigo),
    'materiais', coalesce(v_materiais, '[]'::jsonb),
    'stats', jsonb_build_object(
      'total_diagnosticos', count(*),
      'novos', count(*) FILTER (WHERE ml.status = 'NOVO'),
      'em_contacto', count(*) FILTER (WHERE ml.status = 'EM_CONTACTO'),
      'convertidos', count(*) FILTER (WHERE ml.status = 'CONVERTIDO'),
      'trend', coalesce(v_trend, '[]'::jsonb),
      'onboarding', coalesce(v_onboarding, jsonb_build_object(
        'total', 0, 'pendentes', 0, 'em_configuracao', 0, 'fechadas', 0, 'escolas', '[]'::jsonb
      )),
      'leads', coalesce((
        SELECT jsonb_agg(
          jsonb_build_object(
            'data', recent.created_at,
            'status', recent.status,
            'score', recent.score,
            'escola_hint',
              CASE
                WHEN length(recent.escola) > 5 THEN left(recent.escola, 3) || '***' || right(recent.escola, 2)
                ELSE left(recent.escola, 1) || '***'
              END
          )
          ORDER BY recent.created_at DESC
        )
        FROM (
          SELECT created_at, status, score, escola
          FROM public.marketing_leads
          WHERE upper(afiliado_codigo) = v_codigo
          ORDER BY created_at DESC
          LIMIT 50
        ) recent
      ), '[]'::jsonb)
    )
  )
  INTO v_result
  FROM public.marketing_leads ml
  WHERE upper(ml.afiliado_codigo) = v_codigo;

  RETURN coalesce(v_result, jsonb_build_object(
    'ok', true,
    'codigo', v_codigo,
    'nome', coalesce(v_nome, v_codigo),
    'materiais', coalesce(v_materiais, '[]'::jsonb),
    'stats', jsonb_build_object(
      'total_diagnosticos', 0,
      'novos', 0,
      'em_contacto', 0,
      'convertidos', 0,
      'trend', coalesce(v_trend, '[]'::jsonb),
      'onboarding', coalesce(v_onboarding, jsonb_build_object(
        'total', 0, 'pendentes', 0, 'em_configuracao', 0, 'fechadas', 0, 'escolas', '[]'::jsonb
      )),
      'leads', '[]'::jsonb
    )
  ));
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

  SELECT a.codigo, a.nome, a.materiais_json, m.nome
    INTO v_codigo, v_nome, v_materiais, v_member_nome
  FROM public.afiliados a
  JOIN public.afiliado_membros m ON m.afiliado_id = a.id
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
    SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day')::date AS dia
  ),
  counts AS (
    SELECT ml.created_at::date AS dia, count(*) AS total
    FROM public.marketing_leads ml
    WHERE upper(ml.afiliado_codigo) = v_codigo
      AND ml.created_at >= CURRENT_DATE - INTERVAL '6 days'
    GROUP BY 1
  )
  SELECT jsonb_agg(
    jsonb_build_object('dia', to_char(d.dia, 'DD/MM'), 'total', coalesce(c.total, 0))
    ORDER BY d.dia ASC
  ) INTO v_trend
  FROM dias d
  LEFT JOIN counts c ON d.dia = c.dia;

  SELECT jsonb_build_object(
    'total', count(*),
    'pendentes', count(*) FILTER (WHERE obr.status = 'pendente'),
    'em_configuracao', count(*) FILTER (WHERE obr.status = 'em_configuracao'),
    'fechadas', count(*) FILTER (WHERE obr.status = 'activo'),
    'escolas', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'data', recent.created_at,
          'status', recent.status,
          'escola', recent.escola_nome,
          'plano', recent.financeiro->>'plano_interesse',
          'plano_label', recent.financeiro->>'plano_interesse_label',
          'total_alunos', recent.financeiro->>'total_alunos',
          'token', recent.tracking_token,
          'faixa_propina', recent.faixa_propina,
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
              ORDER BY public.onboarding_step_sort_order(s.step_code), s.created_at ASC
            )
            FROM public.onboarding_steps s
            WHERE s.onboarding_id = recent.id
          ), '[]'::jsonb)
        )
        ORDER BY recent.created_at DESC
      )
      FROM (
        SELECT id, created_at, status, escola_nome, financeiro, tracking_token, faixa_propina
        FROM public.onboarding_requests
        WHERE upper(coalesce(financeiro->>'influencer_codigo', '')) = v_codigo
        ORDER BY created_at DESC
        LIMIT 50
      ) recent
    ), '[]'::jsonb)
  )
  INTO v_onboarding
  FROM public.onboarding_requests obr
  WHERE upper(coalesce(obr.financeiro->>'influencer_codigo', '')) = v_codigo;

  SELECT jsonb_build_object(
    'ok', true,
    'codigo', v_codigo,
    'nome', coalesce(v_nome, v_codigo),
    'member', jsonb_build_object('id', p_member_id, 'name', v_member_nome),
    'materiais', coalesce(v_materiais, '[]'::jsonb),
    'stats', jsonb_build_object(
      'total_diagnosticos', count(*),
      'novos', count(*) FILTER (WHERE ml.status = 'NOVO'),
      'em_contacto', count(*) FILTER (WHERE ml.status = 'EM_CONTACTO'),
      'convertidos', count(*) FILTER (WHERE ml.status = 'CONVERTIDO'),
      'trend', coalesce(v_trend, '[]'::jsonb),
      'onboarding', coalesce(v_onboarding, jsonb_build_object(
        'total', 0, 'pendentes', 0, 'em_configuracao', 0, 'fechadas', 0, 'escolas', '[]'::jsonb
      )),
      'leads', coalesce((
        SELECT jsonb_agg(
          jsonb_build_object(
            'data', recent.created_at,
            'status', recent.status,
            'score', recent.score,
            'escola_hint',
              CASE
                WHEN length(recent.escola) > 5 THEN left(recent.escola, 3) || '***' || right(recent.escola, 2)
                ELSE left(recent.escola, 1) || '***'
              END
          )
          ORDER BY recent.created_at DESC
        )
        FROM (
          SELECT created_at, status, score, escola
          FROM public.marketing_leads
          WHERE upper(afiliado_codigo) = v_codigo
          ORDER BY created_at DESC
          LIMIT 50
        ) recent
      ), '[]'::jsonb)
    )
  )
  INTO v_result
  FROM public.marketing_leads ml
  WHERE upper(ml.afiliado_codigo) = v_codigo;

  RETURN coalesce(v_result, jsonb_build_object(
    'ok', true,
    'codigo', v_codigo,
    'nome', coalesce(v_nome, v_codigo),
    'member', jsonb_build_object('id', p_member_id, 'name', v_member_nome),
    'materiais', coalesce(v_materiais, '[]'::jsonb),
    'stats', jsonb_build_object(
      'total_diagnosticos', 0,
      'novos', 0,
      'em_contacto', 0,
      'convertidos', 0,
      'trend', coalesce(v_trend, '[]'::jsonb),
      'onboarding', coalesce(v_onboarding, jsonb_build_object(
        'total', 0, 'pendentes', 0, 'em_configuracao', 0, 'fechadas', 0, 'escolas', '[]'::jsonb
      )),
      'leads', '[]'::jsonb
    )
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.onboarding_step_sort_order(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.seed_onboarding_steps_v2(uuid, timestamptz, text) TO authenticated, service_role;

COMMIT;
