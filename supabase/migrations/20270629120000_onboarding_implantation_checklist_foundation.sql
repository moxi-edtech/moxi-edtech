BEGIN;

ALTER TABLE public.onboarding_requests
  ADD COLUMN IF NOT EXISTS implantation_status varchar(50) NOT NULL DEFAULT 'implantacao_em_andamento'
    CHECK (implantation_status IN ('implantacao_em_andamento', 'aguardando_aceite', 'aceite_validado')),
  ADD COLUMN IF NOT EXISTS implantation_checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS implantation_checklist_updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.default_onboarding_implantation_checklist()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog, pg_temp
AS $$
  SELECT jsonb_build_array(
    jsonb_build_object('code', 'curriculo_configurado', 'label', 'Currículo configurado', 'completed', false, 'note', null, 'completed_at', null),
    jsonb_build_object('code', 'turmas_criadas', 'label', 'Turmas criadas', 'completed', false, 'note', null, 'completed_at', null),
    jsonb_build_object('code', 'disciplinas_configuradas', 'label', 'Disciplinas e pautas configuradas', 'completed', false, 'note', null, 'completed_at', null),
    jsonb_build_object('code', 'alunos_importados', 'label', 'Alunos importados', 'completed', false, 'note', null, 'completed_at', null),
    jsonb_build_object('code', 'encarregados_importados', 'label', 'Encarregados importados', 'completed', false, 'note', null, 'completed_at', null),
    jsonb_build_object('code', 'formacao_secretaria_concluida', 'label', 'Formação da secretaria concluída', 'completed', false, 'note', null, 'completed_at', null),
    jsonb_build_object('code', 'formacao_docentes_concluida', 'label', 'Formação dos docentes concluída', 'completed', false, 'note', null, 'completed_at', null),
    jsonb_build_object('code', 'sistema_em_operacao', 'label', 'Sistema em operação', 'completed', false, 'note', null, 'completed_at', null)
  );
$$;

UPDATE public.onboarding_requests
SET
  implantation_checklist = public.default_onboarding_implantation_checklist(),
  implantation_checklist_updated_at = now()
WHERE coalesce(jsonb_array_length(implantation_checklist), 0) = 0;

CREATE OR REPLACE FUNCTION public.update_influencer_onboarding_implantation_checklist(
  p_session_id uuid,
  p_codigo text,
  p_tracking_token text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_session jsonb;
  v_codigo_upper text := upper(trim(coalesce(p_codigo, '')));
  v_member_id uuid;
  v_member_name text;
  v_request public.onboarding_requests%ROWTYPE;
  v_normalized jsonb;
  v_completed_count integer;
  v_total_count integer;
  v_next_status text;
BEGIN
  v_session := public.get_influencer_portal_session(p_session_id, p_codigo);
  IF coalesce((v_session->>'ok')::boolean, false) = false THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_not_found');
  END IF;

  v_member_id := (v_session->'session'->>'member_id')::uuid;
  v_member_name := coalesce(v_session->'session'->>'member_name', 'Parceiro');

  SELECT *
    INTO v_request
  FROM public.onboarding_requests r
  WHERE r.tracking_token = p_tracking_token
    AND upper(coalesce(r.financeiro->>'influencer_codigo', '')) = v_codigo_upper
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'onboarding_not_found');
  END IF;

  WITH defaults AS (
    SELECT *
    FROM (
      VALUES
        (1, 'curriculo_configurado', 'Currículo configurado'),
        (2, 'turmas_criadas', 'Turmas criadas'),
        (3, 'disciplinas_configuradas', 'Disciplinas e pautas configuradas'),
        (4, 'alunos_importados', 'Alunos importados'),
        (5, 'encarregados_importados', 'Encarregados importados'),
        (6, 'formacao_secretaria_concluida', 'Formação da secretaria concluída'),
        (7, 'formacao_docentes_concluida', 'Formação dos docentes concluída'),
        (8, 'sistema_em_operacao', 'Sistema em operação')
    ) AS t(sort_order, code, label)
  ),
  provided AS (
    SELECT
      code,
      coalesce(completed, false) AS completed,
      nullif(btrim(note), '') AS note,
      completed_at
    FROM jsonb_to_recordset(coalesce(p_items, '[]'::jsonb))
      AS x(code text, completed boolean, note text, completed_at timestamptz)
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'code', d.code,
      'label', d.label,
      'completed', coalesce(p.completed, false),
      'note', p.note,
      'completed_at', CASE
        WHEN coalesce(p.completed, false)
          THEN coalesce(p.completed_at, now())
        ELSE null
      END
    )
    ORDER BY d.sort_order
  )
  INTO v_normalized
  FROM defaults d
  LEFT JOIN provided p
    ON p.code = d.code;

  SELECT
    count(*) FILTER (WHERE coalesce((item->>'completed')::boolean, false)),
    count(*)
  INTO v_completed_count, v_total_count
  FROM jsonb_array_elements(v_normalized) item;

  v_next_status := CASE
    WHEN v_completed_count = v_total_count
      AND v_total_count > 0
      AND v_request.implantation_status = 'aceite_validado'
      THEN 'aceite_validado'
    WHEN v_completed_count = v_total_count AND v_total_count > 0 THEN 'aguardando_aceite'
    ELSE 'implantacao_em_andamento'
  END;

  UPDATE public.onboarding_requests
  SET
    implantation_checklist = v_normalized,
    implantation_status = v_next_status,
    implantation_checklist_updated_at = now()
  WHERE id = v_request.id;

  INSERT INTO public.audit_logs (
    escola_id,
    portal,
    acao,
    tabela,
    registro_id,
    entity,
    entity_id,
    details
  )
  VALUES (
    v_request.escola_id,
    'influencer_portal',
    'ONBOARDING_IMPLANTATION_CHECKLIST_UPDATED',
    'onboarding_requests',
    v_request.id::text,
    'onboarding_requests',
    v_request.id::text,
    jsonb_build_object(
      'member_id', v_member_id,
      'member_name', v_member_name,
      'influencer_codigo', v_codigo_upper,
      'implantation_status', v_next_status,
      'completed_count', v_completed_count,
      'total_count', v_total_count
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'implantation_status', v_next_status,
    'completed_count', v_completed_count,
    'total_count', v_total_count,
    'checklist', v_normalized
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.default_onboarding_implantation_checklist() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_influencer_onboarding_implantation_checklist(uuid, text, text, jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_influencer_member_portal_by_session(
  p_session_id uuid,
  p_codigo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_session jsonb;
BEGIN
  v_session := public.get_influencer_portal_session(p_session_id, p_codigo);

  IF coalesce((v_session->>'ok')::boolean, false) = false THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_not_found');
  END IF;

  RETURN (
    WITH session_row AS (
      SELECT
        (v_session->'session'->>'codigo')::text AS codigo,
        (v_session->'session'->>'member_id')::uuid AS member_id,
        (v_session->'session'->>'member_name')::text AS member_name
    ),
    affiliate_context AS (
      SELECT
        a.codigo,
        coalesce(a.nome, a.codigo) AS nome,
        a.materiais_json,
        sr.member_id,
        sr.member_name
      FROM session_row sr
      JOIN public.afiliados a
        ON a.codigo = sr.codigo
       AND a.ativo = true
      JOIN public.afiliado_membros m
        ON m.id = sr.member_id
       AND m.afiliado_id = a.id
       AND m.ativo = true
    ),
    dias AS (
      SELECT generate_series(
        CURRENT_DATE - INTERVAL '6 days',
        CURRENT_DATE,
        INTERVAL '1 day'
      )::date AS dia
    ),
    counts AS (
      SELECT
        ml.created_at::date AS dia,
        count(*) AS total
      FROM public.marketing_leads ml
      JOIN affiliate_context ac
        ON upper(ml.afiliado_codigo) = ac.codigo
      WHERE ml.created_at >= CURRENT_DATE - INTERVAL '6 days'
      GROUP BY 1
    ),
    trend AS (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'dia', to_char(d.dia, 'DD/MM'),
            'total', coalesce(c.total, 0)
          )
          ORDER BY d.dia ASC
        ),
        '[]'::jsonb
      ) AS data
      FROM dias d
      LEFT JOIN counts c ON d.dia = c.dia
    ),
    onboarding AS (
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
              'implantation_status', recent.implantation_status,
              'implantation_checklist', coalesce(recent.implantation_checklist, public.default_onboarding_implantation_checklist()),
              'implantation_progress', jsonb_build_object(
                'completed', (
                  SELECT count(*)
                  FROM jsonb_array_elements(coalesce(recent.implantation_checklist, public.default_onboarding_implantation_checklist())) item
                  WHERE coalesce((item->>'completed')::boolean, false)
                ),
                'total', jsonb_array_length(coalesce(recent.implantation_checklist, public.default_onboarding_implantation_checklist()))
              ),
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
              ), '[]'::jsonb),
              'calls', coalesce((
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'id', log.id,
                    'realizado_em', log.created_at,
                    'member_name', coalesce(log.details->>'member_name', ''),
                    'step_title', coalesce(log.details->>'step_title', ''),
                    'notes', coalesce(log.details->>'notes', '')
                  )
                  ORDER BY log.created_at DESC
                )
                FROM public.audit_logs log
                WHERE log.acao = 'PARTNER_CALL_FOLLOWUP'
                  AND log.entity = 'onboarding_requests'
                  AND log.entity_id = recent.id::text
              ), '[]'::jsonb),
              'uploads', coalesce((
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'id', u.id,
                    'step_code', u.step_code,
                    'file_path', u.file_path,
                    'status', u.status,
                    'rejection_reason', u.rejection_reason,
                    'created_by', u.created_by,
                    'created_at', u.created_at
                  )
                  ORDER BY u.created_at DESC
                )
                FROM public.onboarding_uploads u
                WHERE u.onboarding_id = recent.id
              ), '[]'::jsonb),
              'escola_tel', recent.escola_tel,
              'escola_email', recent.escola_email,
              'director_nome', recent.director_nome,
              'director_tel', recent.director_tel,
              'escola_morada', recent.escola_morada,
              'escola_municipio', recent.escola_municipio,
              'escola_provincia', recent.escola_provincia,
              'escola_nif', recent.escola_nif
            )
            ORDER BY recent.created_at DESC
          )
          FROM (
            SELECT
              id,
              created_at,
              status,
              escola_nome,
              financeiro,
              tracking_token,
              faixa_propina,
              implantation_status,
              implantation_checklist,
              escola_tel,
              escola_email,
              director_nome,
              director_tel,
              escola_morada,
              escola_municipio,
              escola_provincia,
              escola_nif
            FROM public.onboarding_requests
            WHERE upper(coalesce(financeiro->>'influencer_codigo', '')) = (SELECT codigo FROM affiliate_context LIMIT 1)
            ORDER BY created_at DESC
            LIMIT 50
          ) recent
        ), '[]'::jsonb)
      ) AS data
      FROM public.onboarding_requests obr
      WHERE upper(coalesce(obr.financeiro->>'influencer_codigo', '')) = (SELECT codigo FROM affiliate_context LIMIT 1)
    ),
    leads AS (
      SELECT coalesce((
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
          WHERE upper(afiliado_codigo) = (SELECT codigo FROM affiliate_context LIMIT 1)
          ORDER BY created_at DESC
          LIMIT 50
        ) recent
      ), '[]'::jsonb) AS data
    ),
    stats AS (
      SELECT jsonb_build_object(
        'total_diagnosticos', count(*),
        'novos', count(*) FILTER (WHERE ml.status = 'NOVO'),
        'em_contacto', count(*) FILTER (WHERE ml.status = 'EM_CONTACTO'),
        'convertidos', count(*) FILTER (WHERE ml.status = 'CONVERTIDO'),
        'trend', (SELECT data FROM trend),
        'onboarding', coalesce((SELECT data FROM onboarding), jsonb_build_object(
          'total', 0,
          'pendentes', 0,
          'em_configuracao', 0,
          'fechadas', 0,
          'escolas', '[]'::jsonb
        )),
        'leads', (SELECT data FROM leads)
      ) AS data
      FROM public.marketing_leads ml
      WHERE upper(ml.afiliado_codigo) = (SELECT codigo FROM affiliate_context LIMIT 1)
    )
    SELECT coalesce(
      (
        SELECT jsonb_build_object(
          'ok', true,
          'codigo', ac.codigo,
          'nome', ac.nome,
          'member', jsonb_build_object(
            'id', ac.member_id,
            'name', ac.member_name
          ),
          'materiais', coalesce(ac.materiais_json, '[]'::jsonb),
          'stats', coalesce((SELECT data FROM stats), jsonb_build_object(
            'total_diagnosticos', 0,
            'novos', 0,
            'em_contacto', 0,
            'convertidos', 0,
            'trend', '[]'::jsonb,
            'onboarding', jsonb_build_object(
              'total', 0,
              'pendentes', 0,
              'em_configuracao', 0,
              'fechadas', 0,
              'escolas', '[]'::jsonb
            ),
            'leads', '[]'::jsonb
          ))
        )
        FROM affiliate_context ac
        LIMIT 1
      ),
      jsonb_build_object('ok', false, 'error', 'session_not_found')
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_influencer_member_portal_by_session(uuid, text) TO anon, authenticated;

COMMIT;
