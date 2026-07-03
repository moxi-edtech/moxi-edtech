BEGIN;

CREATE OR REPLACE FUNCTION public.get_real_school_implantation_checklist(p_escola_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_acesso_ok boolean := false;
  v_curriculo_ok boolean := false;
  v_turmas_ok boolean := false;
  v_disciplinas_ok boolean := false;
  v_alunos_ok boolean := false;
  v_financeiro_ok boolean := false;
  v_secretaria_ok boolean := false;
  v_docentes_ok boolean := false;
  v_sistema_ok boolean := false;
  v_saved jsonb;
  v_saved_sec_note text := null;
  v_saved_doc_note text := null;
  v_saved_sis_note text := null;
BEGIN
  IF p_escola_id IS NULL THEN
    RETURN jsonb_build_array(
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
  END IF;

  -- 1. Primeiro acesso da equipa administrativa:
  -- Se houver pelo menos um utilizador administrativo na escola (papeis secretaria, financeiro ou admin_escola/staff_admin)
  SELECT EXISTS(
    SELECT 1 FROM public.escola_users 
    WHERE escola_id = p_escola_id 
      AND papel IN ('secretaria', 'financeiro', 'admin_escola', 'staff_admin', 'secretaria_financeiro', 'admin_financeiro')
  ) INTO v_acesso_ok;

  -- 2. Currículo acadêmico configurado:
  -- Verifica se existe pelo menos um currículo publicado (published) na escola
  SELECT EXISTS(
    SELECT 1 FROM public.curso_curriculos 
    WHERE escola_id = p_escola_id AND status = 'published'
  ) INTO v_curriculo_ok;

  -- 3. Turmas geradas e organizadas:
  -- Verifica se existem turmas cadastradas para a escola
  SELECT EXISTS(
    SELECT 1 FROM public.turmas 
    WHERE escola_id = p_escola_id
  ) INTO v_turmas_ok;

  -- 4. Disciplinas e pautas configuradas:
  -- Verifica se existem disciplinas vinculadas a turmas
  SELECT EXISTS(
    SELECT 1 FROM public.turma_disciplinas 
    WHERE escola_id = p_escola_id
  ) INTO v_disciplinas_ok;

  -- 5. Alunos importados e matriculados:
  -- Verifica se existe pelo menos uma matrícula ativa/criada na escola
  SELECT EXISTS(
    SELECT 1 FROM public.matriculas 
    WHERE escola_id = p_escola_id
  ) INTO v_alunos_ok;

  -- 6. Preçário e contas financeiras configurados:
  -- Verifica se a tabela de propinas/mensalidades (tabelas financeiras) foi configurada para a escola
  SELECT EXISTS(
    SELECT 1 FROM public.financeiro_tabelas 
    WHERE escola_id = p_escola_id
  ) INTO v_financeiro_ok;

  -- Obter dados manuais salvos anteriormente para formação e homologação do sistema
  SELECT implantation_checklist INTO v_saved 
  FROM public.onboarding_requests 
  WHERE escola_id = p_escola_id;

  IF v_saved IS NOT NULL THEN
    -- Secretaria
    SELECT 
      coalesce((x->>'completed')::boolean, false),
      nullif(btrim(x->>'note'), '')
      INTO v_secretaria_ok, v_saved_sec_note
    FROM jsonb_array_elements(v_saved) x WHERE x->>'code' = 'formacao_secretaria_concluida' LIMIT 1;

    -- Docentes
    SELECT 
      coalesce((x->>'completed')::boolean, false),
      nullif(btrim(x->>'note'), '')
      INTO v_docentes_ok, v_saved_doc_note
    FROM jsonb_array_elements(v_saved) x WHERE x->>'code' = 'formacao_docentes_concluida' LIMIT 1;

    -- Sistema em Operação
    SELECT 
      coalesce((x->>'completed')::boolean, false),
      nullif(btrim(x->>'note'), '')
      INTO v_sistema_ok, v_saved_sis_note
    FROM jsonb_array_elements(v_saved) x WHERE x->>'code' = 'sistema_em_operacao' LIMIT 1;
  END IF;

  RETURN jsonb_build_array(
    jsonb_build_object('code', 'acesso_colaboradores', 'label', 'Primeiro acesso da equipa administrativa', 'completed', v_acesso_ok, 'note', null, 'completed_at', CASE WHEN v_acesso_ok THEN now() ELSE null END),
    jsonb_build_object('code', 'curriculo_configurado', 'label', 'Currículo acadêmico configurado', 'completed', v_curriculo_ok, 'note', null, 'completed_at', CASE WHEN v_curriculo_ok THEN now() ELSE null END),
    jsonb_build_object('code', 'turmas_criadas', 'label', 'Turmas geradas e organizadas', 'completed', v_turmas_ok, 'note', null, 'completed_at', CASE WHEN v_turmas_ok THEN now() ELSE null END),
    jsonb_build_object('code', 'disciplinas_configuradas', 'label', 'Disciplinas e pautas configuradas', 'completed', v_disciplinas_ok, 'note', null, 'completed_at', CASE WHEN v_disciplinas_ok THEN now() ELSE null END),
    jsonb_build_object('code', 'alunos_importados', 'label', 'Alunos importados e matriculados', 'completed', v_alunos_ok, 'note', null, 'completed_at', CASE WHEN v_alunos_ok THEN now() ELSE null END),
    jsonb_build_object('code', 'financeiro_configurado', 'label', 'Preçário e contas financeiras configurados', 'completed', v_financeiro_ok, 'note', null, 'completed_at', CASE WHEN v_financeiro_ok THEN now() ELSE null END),
    jsonb_build_object('code', 'formacao_secretaria_concluida', 'label', 'Formação da secretaria concluída', 'completed', v_secretaria_ok, 'note', v_saved_sec_note, 'completed_at', CASE WHEN v_secretaria_ok THEN now() ELSE null END),
    jsonb_build_object('code', 'formacao_docentes_concluida', 'label', 'Formação dos docentes concluída', 'completed', v_docentes_ok, 'note', v_saved_doc_note, 'completed_at', CASE WHEN v_docentes_ok THEN now() ELSE null END),
    jsonb_build_object('code', 'sistema_em_operacao', 'label', 'Sistema em operação e homologado', 'completed', v_sistema_ok, 'note', v_saved_sis_note, 'completed_at', CASE WHEN v_sistema_ok THEN now() ELSE null END)
  );
END;
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
  v_sec_completed boolean := false;
  v_sec_note text := null;
  v_doc_completed boolean := false;
  v_doc_note text := null;
  v_sis_completed boolean := false;
  v_sis_note text := null;
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

  -- Extract manual toggle elements from the incoming items payload
  SELECT 
    coalesce((x->>'completed')::boolean, false),
    nullif(btrim(x->>'note'), '')
    INTO v_sec_completed, v_sec_note
  FROM jsonb_array_elements(p_items) x WHERE x->>'code' = 'formacao_secretaria_concluida' LIMIT 1;

  SELECT 
    coalesce((x->>'completed')::boolean, false),
    nullif(btrim(x->>'note'), '')
    INTO v_doc_completed, v_doc_note
  FROM jsonb_array_elements(p_items) x WHERE x->>'code' = 'formacao_docentes_concluida' LIMIT 1;

  SELECT 
    coalesce((x->>'completed')::boolean, false),
    nullif(btrim(x->>'note'), '')
    INTO v_sis_completed, v_sis_note
  FROM jsonb_array_elements(p_items) x WHERE x->>'code' = 'sistema_em_operacao' LIMIT 1;

  -- Temporary update raw JSON to allow get_real_school_implantation_checklist to read the manual states
  v_normalized := jsonb_build_array(
    jsonb_build_object('code', 'formacao_secretaria_concluida', 'completed', v_sec_completed, 'note', v_sec_note),
    jsonb_build_object('code', 'formacao_docentes_concluida', 'completed', v_doc_completed, 'note', v_doc_note),
    jsonb_build_object('code', 'sistema_em_operacao', 'completed', v_sis_completed, 'note', v_sis_note)
  );

  UPDATE public.onboarding_requests
  SET implantation_checklist = v_normalized
  WHERE id = v_request.id;

  -- Resolve real combined database + manual checklist
  v_normalized := public.get_real_school_implantation_checklist(v_request.escola_id);

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
          'checklist', public.get_real_school_implantation_checklist(recent.escola_id),
          'implantation_status', CASE
            -- If all items in get_real_school_implantation_checklist are completed, update status
            WHEN (
              SELECT count(*) FILTER (WHERE NOT coalesce((item->>'completed')::boolean, false)) = 0
              FROM jsonb_array_elements(public.get_real_school_implantation_checklist(recent.escola_id)) item
            ) THEN 
              CASE WHEN recent.implantation_status = 'aceite_validado' THEN 'aceite_validado' ELSE 'aguardando_aceite' END
            ELSE 'implantacao_em_andamento'
          END,
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
      r.implantation_status,
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

-- Trigger a full checklist synchronization across all active onboarding requests to compute their live states
DO $$
DECLARE
  v_req record;
  v_live_checklist jsonb;
  v_next_status text;
  v_completed_count integer;
  v_total_count integer;
BEGIN
  FOR v_req IN SELECT id, escola_id, implantation_status FROM public.onboarding_requests LOOP
    IF v_req.escola_id IS NOT NULL THEN
      v_live_checklist := public.get_real_school_implantation_checklist(v_req.escola_id);
      
      SELECT
        count(*) FILTER (WHERE coalesce((item->>'completed')::boolean, false)),
        count(*)
      INTO v_completed_count, v_total_count
      FROM jsonb_array_elements(v_live_checklist) item;

      v_next_status := CASE
        WHEN v_completed_count = v_total_count
          AND v_total_count > 0
          AND v_req.implantation_status = 'aceite_validado'
          THEN 'aceite_validado'
        WHEN v_completed_count = v_total_count AND v_total_count > 0 THEN 'aguardando_aceite'
        ELSE 'implantacao_em_andamento'
      END;

      UPDATE public.onboarding_requests
      SET 
        implantation_checklist = v_live_checklist,
        implantation_status = v_next_status
      WHERE id = v_req.id;
    END IF;
  END LOOP;
END;
$$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES
  ('20270703150000', '20270703150000_make_onboarding_checklist_live_db_checks.sql')
ON CONFLICT (version) DO NOTHING;

COMMIT;
