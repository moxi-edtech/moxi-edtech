BEGIN;

CREATE OR REPLACE FUNCTION public.default_onboarding_implantation_checklist()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog, pg_temp
AS $$
  SELECT jsonb_build_array(
    jsonb_build_object('code', 'acesso_colaboradores', 'label', 'Primeiro acesso da equipa administrativa', 'completed', false, 'note', null, 'completed_at', null),
    jsonb_build_object('code', 'curriculo_configurado', 'label', 'Currículo acadêmico configurado', 'completed', false, 'note', null, 'completed_at', null),
    jsonb_build_object('code', 'turmas_criadas', 'label', 'Turmas geradas e organizadas', 'completed', false, 'note', null, 'completed_at', null),
    jsonb_build_object('code', 'disciplinas_configuradas', 'label', 'Disciplinas e pautas configuradas', 'completed', false, 'note', null, 'completed_at', null),
    jsonb_build_object('code', 'alunos_importados', 'label', 'Alunos importados e matriculados', 'completed', false, 'note', null, 'completed_at', null),
    jsonb_build_object('code', 'financeiro_configurado', 'label', 'Preçário e contas financeiras configurados', 'completed', false, 'note', null, 'completed_at', null),
    jsonb_build_object('code', 'formacao_secretaria_concluida', 'label', 'Formação da secretaria concluída', 'completed', false, 'note', null, 'completed_at', null),
    jsonb_build_object('code', 'formacao_docentes_concluida', 'label', 'Formação dos docentes concluída', 'completed', false, 'note', null, 'completed_at', null),
    jsonb_build_object('code', 'sistema_em_operacao', 'label', 'Sistema em operação e homologado', 'completed', false, 'note', null, 'completed_at', null)
  );
$$;

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
        (1, 'acesso_colaboradores', 'Primeiro acesso da equipa administrativa'),
        (2, 'curriculo_configurado', 'Currículo acadêmico configurado'),
        (3, 'turmas_criadas', 'Turmas geradas e organizadas'),
        (4, 'disciplinas_configuradas', 'Disciplinas e pautas configuradas'),
        (5, 'alunos_importados', 'Alunos importados e matriculados'),
        (6, 'financeiro_configurado', 'Preçário e contas financeiras configurados'),
        (7, 'formacao_secretaria_concluida', 'Formação da secretaria concluída'),
        (8, 'formacao_docentes_concluida', 'Formação dos docentes concluída'),
        (9, 'sistema_em_operacao', 'Sistema em operação e homologado')
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
    'implantation_checklist', v_normalized,
    'implantation_status', v_next_status,
    'implantation_checklist_updated_at', now()
  );
END;
$$;

-- Normalize existing checklists to include the new items and update status
DO $$
DECLARE
  v_req record;
  v_item jsonb;
  v_new_list jsonb;
BEGIN
  FOR v_req IN SELECT id, tracking_token, financeiro->>'influencer_codigo' as codigo, implantation_checklist FROM public.onboarding_requests LOOP
    -- Build new checklist based on the updated defaults
    WITH defaults AS (
      SELECT *
      FROM (
        VALUES
          (1, 'acesso_colaboradores', 'Primeiro acesso da equipa administrativa'),
          (2, 'curriculo_configurado', 'Currículo acadêmico configurado'),
          (3, 'turmas_criadas', 'Turmas geradas e organizadas'),
          (4, 'disciplinas_configuradas', 'Disciplinas e pautas configuradas'),
          (5, 'alunos_importados', 'Alunos importados e matriculados'),
          (6, 'financeiro_configurado', 'Preçário e contas financeiras configurados'),
          (7, 'formacao_secretaria_concluida', 'Formação da secretaria concluída'),
          (8, 'formacao_docentes_concluida', 'Formação dos docentes concluída'),
          (9, 'sistema_em_operacao', 'Sistema em operação e homologado')
      ) AS t(sort_order, code, label)
    ),
    provided AS (
      SELECT
        code,
        coalesce(completed, false) AS completed,
        nullif(btrim(note), '') AS note,
        completed_at
      FROM jsonb_to_recordset(coalesce(v_req.implantation_checklist, '[]'::jsonb))
        AS x(code text, completed boolean, note text, completed_at timestamptz)
    )
    SELECT jsonb_agg(
      jsonb_build_object(
        'code', d.code,
        'label', d.label,
        'completed', coalesce(p.completed, false),
        'note', p.note,
        'completed_at', p.completed_at
      )
      ORDER BY d.sort_order
    )
    INTO v_new_list
    FROM defaults d
    LEFT JOIN provided p
      ON p.code = d.code;

    -- If school is active, mark all items as completed
    IF EXISTS (SELECT 1 FROM public.onboarding_requests WHERE id = v_req.id AND status = 'activo') THEN
      SELECT jsonb_agg(
        jsonb_build_object(
          'code', item->>'code',
          'label', item->>'label',
          'completed', true,
          'note', item->>'note',
          'completed_at', coalesce((item->>'completed_at')::timestamptz, now())
        )
      ) INTO v_new_list
      FROM jsonb_array_elements(v_new_list) item;
    END IF;

    UPDATE public.onboarding_requests
    SET implantation_checklist = v_new_list
    WHERE id = v_req.id;
  END LOOP;
END;
$$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES
  ('20270703140000', '20270703140000_optimize_implantation_checklist_items.sql')
ON CONFLICT (version) DO NOTHING;

COMMIT;
