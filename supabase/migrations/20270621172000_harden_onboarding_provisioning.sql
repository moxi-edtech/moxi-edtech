BEGIN;

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

CREATE OR REPLACE FUNCTION public.provisionar_escola_from_onboarding(
  p_request_id uuid,
  p_escola_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, extensions
AS $$
BEGIN
  RETURN public.provisionar_escola_from_onboarding(
    p_request_id,
    p_escola_id,
    NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_and_provision_escola_from_onboarding(
  p_request_id uuid,
  p_nome text,
  p_nif text DEFAULT NULL,
  p_endereco text DEFAULT NULL,
  p_plano text DEFAULT NULL,
  p_admin_email text DEFAULT NULL,
  p_admin_telefone text DEFAULT NULL,
  p_admin_nome text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, extensions
AS $$
DECLARE
  v_created jsonb;
  v_provision jsonb;
  v_escola_id uuid;
BEGIN
  v_created := to_jsonb(
    public.create_escola_with_admin(
      p_nome,
      p_nif,
      p_endereco,
      p_admin_email,
      p_admin_telefone,
      p_admin_nome
    )
  );

  IF coalesce((v_created->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Falha ao criar escola.';
  END IF;

  v_escola_id := coalesce(
    nullif(v_created->>'escolaId', ''),
    nullif(v_created->>'escola_id', '')
  )::uuid;

  IF v_escola_id IS NULL THEN
    RAISE EXCEPTION 'RPC de criação não devolveu escola_id.';
  END IF;

  IF p_plano IS NOT NULL AND p_plano IN ('essencial', 'profissional', 'premium') THEN
    UPDATE public.escolas
    SET plano_atual = p_plano
    WHERE id = v_escola_id;
  END IF;

  v_provision := public.provisionar_escola_from_onboarding(
    p_request_id,
    v_escola_id,
    p_actor_id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'escola', v_created,
    'escola_id', v_escola_id,
    'provision', v_provision
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.provisionar_escola_from_onboarding(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.provisionar_escola_from_onboarding(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_and_provision_escola_from_onboarding(uuid, text, text, text, text, text, text, text, uuid) TO authenticated, service_role;

COMMIT;
