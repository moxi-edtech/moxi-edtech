BEGIN;

-- 1. Alter crm_leads to add trial_days and taxa_ativacao
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS trial_days integer DEFAULT 15 CHECK (trial_days >= 0 AND trial_days <= 30),
  ADD COLUMN IF NOT EXISTS taxa_ativacao integer DEFAULT 50000 CHECK (taxa_ativacao >= 0);

COMMENT ON COLUMN public.crm_leads.trial_days IS 'Dias de degustação gratuitos negociados pelo parceiro para o colégio (máx 30).';
COMMENT ON COLUMN public.crm_leads.taxa_ativacao IS 'Valor em Kz da taxa de ativação/instalação acordada com o colégio.';

-- 2. Update create_influencer_crm_lead function to accept and insert these values
CREATE OR REPLACE FUNCTION public.create_influencer_crm_lead(
  p_session_id uuid,
  p_codigo text,
  p_nome_escola text,
  p_nome_contacto text,
  p_telefone text,
  p_email text,
  p_segmento text,
  p_alunos_estimados integer,
  p_plano_estimado text,
  p_proxima_acao text,
  p_proxima_acao_data timestamptz DEFAULT NULL,
  p_trial_days integer DEFAULT 15,
  p_taxa_ativacao integer DEFAULT 50000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_session jsonb;
  v_codigo_upper text := upper(trim(p_codigo));
  v_member_id uuid;
  v_lead_id uuid;
BEGIN
  -- Verify session
  v_session := public.get_influencer_portal_session(p_session_id, p_codigo);
  IF coalesce((v_session->>'ok')::boolean, false) = false THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_not_found');
  END IF;

  v_member_id := (v_session->'session'->>'member_id')::uuid;

  INSERT INTO public.crm_leads (
    afiliado_codigo,
    membro_id,
    nome_escola,
    nome_contacto,
    telefone,
    email,
    segmento,
    alunos_estimados,
    plano_estimado,
    proxima_acao,
    proxima_acao_data,
    trial_days,
    taxa_ativacao
  ) VALUES (
    v_codigo_upper,
    v_member_id,
    p_nome_escola,
    p_nome_contacto,
    p_telefone,
    p_email,
    p_segmento,
    p_alunos_estimados,
    p_plano_estimado,
    p_proxima_acao,
    p_proxima_acao_data,
    coalesce(p_trial_days, 15),
    coalesce(p_taxa_ativacao, 50000)
  )
  RETURNING id INTO v_lead_id;

  RETURN jsonb_build_object(
    'ok', true,
    'lead_id', v_lead_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_influencer_crm_lead(uuid, text, text, text, text, text, text, integer, text, text, timestamptz, integer, integer) TO anon, authenticated;

-- 3. Update convert_influencer_crm_lead_to_onboarding function
CREATE OR REPLACE FUNCTION public.convert_influencer_crm_lead_to_onboarding(
  p_session_id uuid,
  p_codigo text,
  p_lead_id uuid
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
  v_afiliado_id uuid;
  v_lead public.crm_leads%ROWTYPE;
  v_request_id uuid;
  v_tracking_token text;
  v_plan_label text;
BEGIN
  v_session := public.get_influencer_portal_session(p_session_id, p_codigo);
  IF coalesce((v_session->>'ok')::boolean, false) = false THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_not_found');
  END IF;

  v_member_id := (v_session->'session'->>'member_id')::uuid;
  v_member_name := coalesce(v_session->'session'->>'member_name', 'Parceiro');

  SELECT a.id
    INTO v_afiliado_id
  FROM public.afiliados a
  JOIN public.afiliado_membros m
    ON m.afiliado_id = a.id
   AND m.id = v_member_id
   AND m.ativo = true
  WHERE a.codigo = v_codigo_upper
    AND a.ativo = true
  LIMIT 1;

  IF v_afiliado_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'affiliate_not_found');
  END IF;

  SELECT *
    INTO v_lead
  FROM public.crm_leads
  WHERE id = p_lead_id
    AND afiliado_codigo = v_codigo_upper
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lead_not_found_or_access_denied');
  END IF;

  IF v_lead.etapa = 'perdido' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lost_lead_cannot_convert');
  END IF;

  IF v_lead.onboarding_request_id IS NOT NULL THEN
    SELECT r.tracking_token
      INTO v_tracking_token
    FROM public.onboarding_requests r
    WHERE r.id = v_lead.onboarding_request_id;

    RETURN jsonb_build_object(
      'ok', true,
      'already_converted', true,
      'onboarding_request_id', v_lead.onboarding_request_id,
      'tracking_token', v_tracking_token
    );
  END IF;

  v_plan_label := CASE v_lead.plano_estimado
    WHEN 'profissional' THEN 'Profissional'
    WHEN 'premium' THEN 'Premium'
    ELSE 'Essencial'
  END;

  INSERT INTO public.onboarding_requests (
    status,
    escola_nome,
    escola_tel,
    escola_email,
    director_nome,
    director_tel,
    financeiro,
    utilizadores,
    notas_admin,
    crm_lead_id
  )
  VALUES (
    'pendente',
    v_lead.nome_escola,
    v_lead.telefone,
    v_lead.email,
    v_lead.nome_contacto,
    v_lead.telefone,
    jsonb_build_object(
      'total_alunos', nullif(v_lead.alunos_estimados, 0)::text,
      'plano_interesse', v_lead.plano_estimado,
      'plano_interesse_label', v_plan_label,
      'origem_campanha', 'crm_parceiro',
      'influencer_codigo', v_codigo_upper,
      'crm_lead_id', v_lead.id,
      'converted_by_membro_id', v_member_id,
      'converted_by_membro_nome', v_member_name,
      'trial_days', v_lead.trial_days,
      'taxa_ativacao', v_lead.taxa_ativacao
    ),
    jsonb_build_object(
      'principal', jsonb_build_object(
        'nome', coalesce(v_lead.nome_contacto, v_lead.nome_escola),
        'tel', coalesce(v_lead.telefone, ''),
        'nivel_exp', ''
      )
    ),
    'Pedido criado automaticamente a partir de lead CRM do parceiro ' || v_codigo_upper || '.',
    v_lead.id
  )
  RETURNING id, tracking_token INTO v_request_id, v_tracking_token;

  UPDATE public.crm_leads
  SET
    etapa = 'ganho',
    onboarding_request_id = v_request_id,
    converted_at = now(),
    converted_by_membro_id = v_member_id
  WHERE id = v_lead.id;

  INSERT INTO public.audit_logs (
    escola_id,
    user_id,
    acao,
    entity,
    entity_id,
    details
  )
  VALUES (
    NULL,
    coalesce(v_member_id::text, 'system'),
    'CRM_LEAD_CONVERTED_TO_ONBOARDING',
    'crm_leads',
    v_lead.id::text,
    jsonb_build_object(
      'lead_nome', v_lead.nome_escola,
      'afiliado_codigo', v_codigo_upper,
      'member_name', v_member_name,
      'onboarding_request_id', v_request_id,
      'tracking_token', v_tracking_token
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'already_converted', false,
    'onboarding_request_id', v_request_id,
    'tracking_token', v_tracking_token
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.convert_influencer_crm_lead_to_onboarding(uuid, text, uuid) TO anon, authenticated;

-- 4. Update provisionar_escola_from_onboarding to auto-create subscription and activation commission
CREATE OR REPLACE FUNCTION public.provisionar_escola_from_onboarding(
  p_request_id uuid,
  p_escola_id uuid,
  p_actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, extensions
AS $$
DECLARE
  v_req public.onboarding_requests%ROWTYPE;
  v_ano_letivo_id uuid;
  v_classe record;
  v_classe_id uuid;
  v_turno text;
  v_classe_slug text;
  v_turma_count int;
  v_turma_index int;
  v_turma_letra text;
  v_inserted_classes int := 0;
  v_inserted_turmas int := 0;
  v_total_steps int := 0;
  v_pending_steps int := 0;
  v_escola_exists boolean := false;
  v_result jsonb;
BEGIN
  SELECT *
    INTO v_req
  FROM public.onboarding_requests
  WHERE id = p_request_id;

  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Pedido de onboarding não encontrado.';
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM public.escolas
    WHERE id = p_escola_id
  ) INTO v_escola_exists;

  IF NOT v_escola_exists THEN
    RAISE EXCEPTION 'Escola destino não encontrada.';
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE status <> 'concluido')
    INTO v_total_steps, v_pending_steps
  FROM public.onboarding_steps
  WHERE onboarding_id = p_request_id;

  IF v_total_steps = 0 THEN
    RAISE EXCEPTION 'Pedido de onboarding sem etapas configuradas.';
  END IF;

  IF v_pending_steps > 0 THEN
    RAISE EXCEPTION 'Provisionamento bloqueado: ainda existem etapas pendentes.';
  END IF;

  IF v_req.escola_id IS NOT NULL AND v_req.escola_id <> p_escola_id THEN
    RAISE EXCEPTION 'Pedido já vinculado a outra escola.';
  END IF;

  IF v_req.status = 'activo' AND v_req.escola_id = p_escola_id THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_provisioned', true,
      'classes_criadas', 0,
      'turmas_criadas', 0,
      'ano_letivo_id', null
    );
  END IF;

  INSERT INTO public.anos_letivos (escola_id, ano, nome, data_inicio, data_fim, ativo)
  VALUES (
    p_escola_id,
    v_req.ano_letivo::int,
    'Ano Letivo ' || v_req.ano_letivo,
    (v_req.ano_letivo || '-02-01')::date,
    (v_req.ano_letivo || '-12-15')::date,
    true
  )
  ON CONFLICT (escola_id, ano) DO UPDATE SET ativo = true
  RETURNING id INTO v_ano_letivo_id;

  FOR v_classe IN
    SELECT *
    FROM jsonb_to_recordset(v_req.classes) AS x(id text, nome text, nivel text, activa boolean, propina numeric)
  LOOP
    IF v_classe.activa THEN
      INSERT INTO public.classes (escola_id, nome, nivel, activa)
      VALUES (p_escola_id, v_classe.nome, v_classe.nivel, true)
      ON CONFLICT (escola_id, nome) DO UPDATE SET activa = true
      RETURNING id INTO v_classe_id;

      v_inserted_classes := v_inserted_classes + 1;

      INSERT INTO public.financeiro_tabelas (escola_id, ano_letivo, classe_id, valor_mensalidade, dia_vencimento)
      VALUES (
        p_escola_id,
        v_req.ano_letivo::int,
        v_classe_id,
        v_classe.propina,
        coalesce(nullif(v_req.financeiro->>'dia_vencimento', '')::int, 10)
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  FOR v_turno IN
    SELECT jsonb_object_keys(v_req.turmas)
  LOOP
    FOR v_classe_slug, v_turma_count IN
      SELECT *
      FROM jsonb_each_text(v_req.turmas->v_turno)
    LOOP
      SELECT id
        INTO v_classe_id
      FROM public.classes
      WHERE escola_id = p_escola_id
        AND (
          (v_classe_slug = 'ini' AND nome = 'Iniciação')
          OR nome = v_classe_slug || 'ª Classe'
        )
      LIMIT 1;

      IF v_classe_id IS NOT NULL THEN
        FOR v_turma_index IN 1..v_turma_count::int LOOP
          v_turma_letra := CHR(64 + v_turma_index);

          INSERT INTO public.turmas (
            escola_id, nome, curso_id, classe_id, ano_letivo, turno, status_fecho
          ) VALUES (
            p_escola_id,
            v_classe_slug || 'ª ' || v_turno || '-' || v_turma_letra,
            null,
            v_classe_id,
            v_req.ano_letivo::int,
            v_turno,
            'ABERTO'
          ) ON CONFLICT DO NOTHING;

          v_inserted_turmas := v_inserted_turmas + 1;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;

  UPDATE public.onboarding_requests
  SET status = 'activo',
      escola_id = p_escola_id,
      updated_at = now()
  WHERE id = p_request_id;

  v_result := jsonb_build_object(
    'ok', true,
    'already_provisioned', false,
    'classes_criadas', v_inserted_classes,
    'turmas_criadas', v_inserted_turmas,
    'ano_letivo_id', v_ano_letivo_id
  );

  -- Create Subscription & Activation Commission if associated with a partner
  DECLARE
    v_afiliado_codigo text;
    v_afiliado_id uuid;
    v_membro_id uuid;
    v_taxa_ativacao integer;
    v_trial_days integer;
    v_plano_interesse text;
    v_plan_tier public.app_plan_tier;
    v_valor_mensal integer;
    v_data_renovacao timestamptz;
  BEGIN
    v_afiliado_codigo := upper(trim(coalesce(v_req.financeiro->>'influencer_codigo', '')));
    v_plano_interesse := coalesce(v_req.financeiro->>'plano_interesse', 'essencial');
    v_plan_tier := v_plano_interesse::public.app_plan_tier;

    SELECT coalesce(price_mensal_kz, 80000) INTO v_valor_mensal
    FROM public.app_plan_limits
    WHERE plan = v_plan_tier
    LIMIT 1;

    IF v_valor_mensal IS NULL THEN
      IF v_plano_interesse = 'profissional' THEN
        v_valor_mensal := 140000;
      ELSIF v_plano_interesse = 'premium' THEN
        v_valor_mensal := 250000;
      ELSE
        v_valor_mensal := 80000;
      END IF;
    END IF;

    v_trial_days := coalesce(nullif(v_req.financeiro->>'trial_days', '')::integer, 15);
    IF v_trial_days < 0 OR v_trial_days > 30 THEN
      v_trial_days := 15;
    END IF;

    v_data_renovacao := now() + (v_trial_days || ' days')::interval;

    -- Insert active/pending subscription with custom trial duration
    IF NOT EXISTS (SELECT 1 FROM public.assinaturas WHERE escola_id = p_escola_id) THEN
      INSERT INTO public.assinaturas (
        escola_id,
        plano,
        ciclo,
        status,
        metodo_pagamento,
        valor_kz,
        data_inicio,
        data_renovacao,
        notas_internas
      )
      VALUES (
        p_escola_id,
        v_plan_tier,
        'mensal',
        'pendente',
        'transferencia',
        v_valor_mensal,
        now(),
        v_data_renovacao,
        'Criada automaticamente via onboarding. Trial de ' || v_trial_days || ' dias.'
      );
    END IF;

    -- Insert 100% activation commission
    IF v_afiliado_codigo <> '' THEN
      SELECT id INTO v_afiliado_id
      FROM public.afiliados
      WHERE codigo = v_afiliado_codigo AND ativo = true
      LIMIT 1;

      IF v_afiliado_id IS NOT NULL THEN
        v_membro_id := nullif(v_req.financeiro->>'converted_by_membro_id', '')::uuid;
        v_taxa_ativacao := coalesce(nullif(v_req.financeiro->>'taxa_ativacao', '')::integer, 50000);

        INSERT INTO public.partner_commissions (
          afiliado_id,
          afiliado_codigo,
          membro_id,
          escola_id,
          onboarding_request_id,
          crm_lead_id,
          tipo,
          base_valor_kz,
          percentual,
          valor_kz,
          status,
          due_at,
          metadata
        )
        VALUES (
          v_afiliado_id,
          v_afiliado_codigo,
          v_membro_id,
          p_escola_id,
          v_req.id,
          v_req.crm_lead_id,
          'ativacao',
          v_taxa_ativacao,
          1.0000,
          v_taxa_ativacao,
          'pending',
          now() + interval '7 days',
          jsonb_build_object(
            'source', 'onboarding_provisioning',
            'generated_by', 'provisionar_escola_from_onboarding',
            'actor_id', p_actor_id
          )
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END;

  IF p_actor_id IS NOT NULL THEN
    INSERT INTO public.audit_logs (
      escola_id,
      actor_id,
      action,
      entity,
      entity_id,
      portal,
      details
    )
    VALUES (
      p_escola_id,
      p_actor_id,
      'ONBOARDING_PROVISIONAR_ESCOLA',
      'onboarding_requests',
      p_request_id::text,
      'super-admin',
      jsonb_build_object(
        'request_id', p_request_id,
        'escola_id', p_escola_id,
        'result', v_result
      )
    );
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.provisionar_escola_from_onboarding(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.provisionar_escola_from_onboarding(uuid, uuid) TO authenticated, service_role;

COMMIT;
