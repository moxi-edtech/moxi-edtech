BEGIN;

DROP TYPE IF EXISTS sandbox_validation CASCADE;
DROP TYPE IF EXISTS sandbox_diff_entry CASCADE;
DROP TYPE IF EXISTS sandbox_impact CASCADE;
DROP TYPE IF EXISTS sandbox_preview_result CASCADE;
DROP TYPE IF EXISTS sandbox_commit_result CASCADE;

DROP FUNCTION IF EXISTS public.preview_apply_changes(uuid, integer, jsonb);
DROP FUNCTION IF EXISTS public.config_commit(uuid, integer, jsonb, text);

CREATE TYPE sandbox_validation AS (
  regra text,
  severidade text,
  entidade text,
  mensagem text,
  bloqueante boolean
);

CREATE TYPE sandbox_diff_entry AS (
  entidade text,
  campo text,
  antes text,
  depois text
);

CREATE TYPE sandbox_impact AS (
  alunos_impactados int,
  turmas_afetadas int,
  professores_envolvidos int,
  disciplinas_afetadas int
);

CREATE OR REPLACE FUNCTION public.preview_apply_changes(
  p_escola_id uuid,
  p_ano_letivo_id uuid,
  p_changes jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_validations jsonb := '[]'::jsonb;
  v_diff jsonb := '[]'::jsonb;
  v_blockers int := 0;
  v_warnings int := 0;
  v_periodos_novos jsonb;
  v_periodo_ant jsonb;
  v_i int;
  v_j int;
  v_modelo_novo text;
  v_modelo_atual text;
  v_curriculo_id uuid;
  v_curriculo_status text;
  v_alunos int := 0;
  v_turmas int := 0;
  v_professores int := 0;
  v_disciplinas int := 0;
BEGIN
  IF p_escola_id IS DISTINCT FROM public.current_tenant_escola_id() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT public.user_has_role_in_school(p_escola_id, ARRAY['admin_escola', 'secretaria', 'admin']) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_periodos_novos := p_changes -> 'periodos';

  IF v_periodos_novos IS NOT NULL AND jsonb_array_length(v_periodos_novos) > 0 THEN
    IF jsonb_array_length(v_periodos_novos) != 3 THEN
      v_validations := v_validations || jsonb_build_array(jsonb_build_object(
        'regra', 'tres_trimestres_obrigatorios',
        'severidade', 'P0',
        'entidade', 'periodos_letivos',
        'mensagem', 'O ano letivo deve ter exactamente 3 trimestres. Encontrado: ' || jsonb_array_length(v_periodos_novos)::text,
        'bloqueante', true
      ));
      v_blockers := v_blockers + 1;
    END IF;

    FOR v_i IN 0 .. jsonb_array_length(v_periodos_novos) - 1 LOOP
      FOR v_j IN v_i + 1 .. jsonb_array_length(v_periodos_novos) - 1 LOOP
        DECLARE
          dt_ini_a date := (v_periodos_novos -> v_i ->> 'data_inicio')::date;
          dt_fim_a date := (v_periodos_novos -> v_i ->> 'data_fim')::date;
          dt_ini_b date := (v_periodos_novos -> v_j ->> 'data_inicio')::date;
          dt_fim_b date := (v_periodos_novos -> v_j ->> 'data_fim')::date;
        BEGIN
          IF dt_ini_a <= dt_fim_b AND dt_ini_b <= dt_fim_a THEN
            v_validations := v_validations || jsonb_build_array(jsonb_build_object(
              'regra', 'periodo_sem_sobreposicao',
              'severidade', 'P0',
              'entidade', 'periodos_letivos',
              'mensagem', 'Trimestre ' || (v_i + 1)::text || ' e ' || (v_j + 1)::text || ' têm datas sobrepostas.',
              'bloqueante', true
            ));
            v_blockers := v_blockers + 1;
          END IF;
        END;
      END LOOP;
    END LOOP;

    FOR v_i IN 0 .. jsonb_array_length(v_periodos_novos) - 1 LOOP
      DECLARE
        dt_fim_p date := (v_periodos_novos -> v_i ->> 'data_fim')::date;
        dt_trava timestamptz := NULLIF(v_periodos_novos -> v_i ->> 'trava_notas_em', '')::timestamptz;
      BEGIN
        IF dt_trava IS NOT NULL AND dt_trava::date < dt_fim_p THEN
          v_validations := v_validations || jsonb_build_array(jsonb_build_object(
            'regra', 'trava_apos_fim_periodo',
            'severidade', 'P1',
            'entidade', 'periodos_letivos',
            'mensagem', 'Trimestre ' || (v_i + 1)::text || ': trava de notas (' || dt_trava::date::text || ') é anterior ao fim do período (' || dt_fim_p::text || ').',
            'bloqueante', true
          ));
          v_blockers := v_blockers + 1;
        END IF;
      END;
    END LOOP;

    FOR v_i IN 0 .. jsonb_array_length(v_periodos_novos) - 1 LOOP
      DECLARE
        v_num int := (v_periodos_novos -> v_i ->> 'numero')::int;
      BEGIN
        SELECT to_jsonb(pl) INTO v_periodo_ant
        FROM periodos_letivos pl
        WHERE pl.escola_id = p_escola_id
          AND pl.ano_letivo_id = p_ano_letivo_id
          AND pl.numero = v_num
        LIMIT 1;

        IF v_periodo_ant IS NOT NULL THEN
          IF (v_periodo_ant ->> 'data_inicio') != (v_periodos_novos -> v_i ->> 'data_inicio') THEN
            v_diff := v_diff || jsonb_build_array(jsonb_build_object(
              'entidade', 'Trimestre ' || v_num::text,
              'campo', 'data_inicio',
              'antes', v_periodo_ant ->> 'data_inicio',
              'depois', v_periodos_novos -> v_i ->> 'data_inicio'
            ));
          END IF;
          IF (v_periodo_ant ->> 'data_fim') != (v_periodos_novos -> v_i ->> 'data_fim') THEN
            v_diff := v_diff || jsonb_build_array(jsonb_build_object(
              'entidade', 'Trimestre ' || v_num::text,
              'campo', 'data_fim',
              'antes', v_periodo_ant ->> 'data_fim',
              'depois', v_periodos_novos -> v_i ->> 'data_fim'
            ));
          END IF;
        END IF;
      END;
    END LOOP;
  END IF;

  v_modelo_novo := p_changes ->> 'avaliacao_modelo';

  IF v_modelo_novo IS NOT NULL THEN
    IF v_modelo_novo NOT IN ('simplificado', 'mac_npp_pt', 'personalizado') THEN
      v_validations := v_validations || jsonb_build_array(jsonb_build_object(
        'regra', 'modelo_avaliacao_valido',
        'severidade', 'P0',
        'entidade', 'avaliacao_config',
        'mensagem', 'Modelo de avaliação inválido: ' || v_modelo_novo,
        'bloqueante', true
      ));
      v_blockers := v_blockers + 1;
    END IF;

    DECLARE
      v_notas_existentes int;
    BEGIN
      SELECT COUNT(*) INTO v_notas_existentes
      FROM notas n
      JOIN avaliacoes a ON a.id = n.avaliacao_id
      WHERE a.escola_id = p_escola_id
        AND a.ano_letivo = (SELECT ano FROM anos_letivos WHERE id = p_ano_letivo_id)
        AND n.valor IS NOT NULL;

      IF v_notas_existentes > 0 THEN
        v_validations := v_validations || jsonb_build_array(jsonb_build_object(
          'regra', 'mudanca_modelo_com_notas',
          'severidade', 'WARN',
          'entidade', 'notas',
          'mensagem', 'Existem ' || v_notas_existentes::text || ' notas já lançadas. Mudar o modelo pode afectar fórmulas de cálculo.',
          'bloqueante', false
        ));
        v_warnings := v_warnings + 1;
      END IF;
    END;

    SELECT e.settings ->> 'avaliacao_modelo' INTO v_modelo_atual
    FROM escolas e WHERE e.id = p_escola_id;

    IF v_modelo_atual IS DISTINCT FROM v_modelo_novo THEN
      v_diff := v_diff || jsonb_build_array(jsonb_build_object(
        'entidade', 'Avaliação',
        'campo', 'modelo',
        'antes', COALESCE(v_modelo_atual, 'não configurado'),
        'depois', v_modelo_novo
      ));
    END IF;
  END IF;

  v_curriculo_id := (p_changes ->> 'curriculo_id')::uuid;

  IF v_curriculo_id IS NOT NULL THEN
    SELECT status INTO v_curriculo_status
    FROM curso_curriculos
    WHERE id = v_curriculo_id
      AND escola_id = p_escola_id;

    IF v_curriculo_status IS NULL THEN
      v_validations := v_validations || jsonb_build_array(jsonb_build_object(
        'regra', 'curriculo_existe',
        'severidade', 'P0',
        'entidade', 'curso_curriculos',
        'mensagem', 'Currículo não encontrado para esta escola.',
        'bloqueante', true
      ));
      v_blockers := v_blockers + 1;
    ELSIF v_curriculo_status != 'draft' THEN
      v_validations := v_validations || jsonb_build_array(jsonb_build_object(
        'regra', 'curriculo_em_draft',
        'severidade', 'P0',
        'entidade', 'curso_curriculos',
        'mensagem', 'Apenas currículos em draft podem ser publicados. Estado actual: ' || v_curriculo_status,
        'bloqueante', true
      ));
      v_blockers := v_blockers + 1;
    ELSE
      DECLARE
        v_itens int;
      BEGIN
        SELECT COUNT(*) INTO v_itens
        FROM curriculo_itens
        WHERE curso_curriculo_id = v_curriculo_id
          AND escola_id = p_escola_id;

        IF v_itens = 0 THEN
          v_validations := v_validations || jsonb_build_array(jsonb_build_object(
            'regra', 'curriculo_com_itens',
            'severidade', 'P1',
            'entidade', 'curriculo_itens',
            'mensagem', 'O currículo não tem disciplinas configuradas.',
            'bloqueante', true
          ));
          v_blockers := v_blockers + 1;
        ELSE
          v_diff := v_diff || jsonb_build_array(jsonb_build_object(
            'entidade', 'Currículo',
            'campo', 'status',
            'antes', 'draft',
            'depois', 'published'
          ));
        END IF;
      END;
    END IF;
  END IF;

  SELECT COUNT(DISTINCT m.id) INTO v_alunos
  FROM matriculas m
  WHERE m.escola_id = p_escola_id
    AND m.ano_letivo_id = p_ano_letivo_id
    AND m.status = 'activa';

  SELECT COUNT(*) INTO v_turmas
  FROM turmas t
  WHERE t.escola_id = p_escola_id
    AND t.ano_letivo_id = p_ano_letivo_id;

  SELECT COUNT(DISTINCT td.professor_id) INTO v_professores
  FROM turma_disciplinas td
  JOIN turmas t ON t.id = td.turma_id
  WHERE t.escola_id = p_escola_id
    AND t.ano_letivo_id = p_ano_letivo_id
    AND td.professor_id IS NOT NULL;

  SELECT COUNT(DISTINCT td.disciplina_id) INTO v_disciplinas
  FROM turma_disciplinas td
  JOIN turmas t ON t.id = td.turma_id
  WHERE t.escola_id = p_escola_id
    AND t.ano_letivo_id = p_ano_letivo_id;

  RETURN jsonb_build_object(
    'ok', true,
    'can_commit', v_blockers = 0,
    'blockers', v_blockers,
    'warnings', v_warnings,
    'validations', v_validations,
    'diff', v_diff,
    'impact', jsonb_build_object(
      'alunos_impactados', v_alunos,
      'turmas_afetadas', v_turmas,
      'professores_envolvidos', v_professores,
      'disciplinas_afetadas', v_disciplinas
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok', false,
    'error', SQLERRM
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.config_commit(
  p_escola_id uuid,
  p_ano_letivo_id uuid,
  p_changes jsonb,
  p_idempotency_key text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preview jsonb;
  v_applied jsonb := '[]'::jsonb;
  v_periodos_novos jsonb;
  v_periodo jsonb;
  v_modelo_novo text;
  v_curriculo_id uuid;
  v_i int;
  v_existing_key text;
BEGIN
  IF p_escola_id IS DISTINCT FROM public.current_tenant_escola_id() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT public.user_has_role_in_school(p_escola_id, ARRAY['admin_escola', 'secretaria', 'admin']) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_user_id IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT details ->> 'idempotency_result' INTO v_existing_key
  FROM audit_logs
  WHERE escola_id = p_escola_id
    AND action = 'CONFIG_COMMIT'
    AND details ->> 'idempotency_key' = p_idempotency_key
  LIMIT 1;

  IF v_existing_key IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'message', 'Já processado com esta chave.',
      'applied', '[]'::jsonb
    );
  END IF;

  v_preview := preview_apply_changes(p_escola_id, p_ano_letivo_id, p_changes);

  IF NOT (v_preview ->> 'ok')::boolean THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Preview falhou: ' || (v_preview ->> 'error')
    );
  END IF;

  IF NOT (v_preview ->> 'can_commit')::boolean THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Existem bloqueadores P0/P1 que impedem a publicação.',
      'blockers', v_preview -> 'blockers',
      'validations', v_preview -> 'validations'
    );
  END IF;

  v_periodos_novos := p_changes -> 'periodos';
  IF v_periodos_novos IS NOT NULL AND jsonb_array_length(v_periodos_novos) > 0 THEN
    FOR v_i IN 0 .. jsonb_array_length(v_periodos_novos) - 1 LOOP
      v_periodo := v_periodos_novos -> v_i;

      INSERT INTO periodos_letivos (
        id, escola_id, ano_letivo_id, tipo, numero,
        data_inicio, data_fim, trava_notas_em
      )
      VALUES (
        gen_random_uuid(),
        p_escola_id,
        p_ano_letivo_id,
        'TRIMESTRE',
        (v_periodo ->> 'numero')::int,
        (v_periodo ->> 'data_inicio')::date,
        (v_periodo ->> 'data_fim')::date,
        NULLIF(v_periodo ->> 'trava_notas_em', '')::timestamptz
      )
      ON CONFLICT (escola_id, ano_letivo_id, tipo, numero)
      DO UPDATE SET
        data_inicio = EXCLUDED.data_inicio,
        data_fim = EXCLUDED.data_fim,
        trava_notas_em = EXCLUDED.trava_notas_em,
        updated_at = now();

      v_applied := v_applied || jsonb_build_array(jsonb_build_object(
        'entidade', 'periodos_letivos',
        'operacao', 'upsert',
        'numero', (v_periodo ->> 'numero')::int
      ));
    END LOOP;
  END IF;

  v_modelo_novo := p_changes ->> 'avaliacao_modelo';
  IF v_modelo_novo IS NOT NULL THEN
    UPDATE escolas
    SET settings = jsonb_set(
      COALESCE(settings, '{}'::jsonb),
      '{avaliacao_modelo}',
      to_jsonb(v_modelo_novo)
    )
    WHERE id = p_escola_id;

    v_applied := v_applied || jsonb_build_array(jsonb_build_object(
      'entidade', 'escolas.settings',
      'operacao', 'update',
      'campo', 'avaliacao_modelo',
      'valor', v_modelo_novo
    ));
  END IF;

  v_curriculo_id := (p_changes ->> 'curriculo_id')::uuid;
  IF v_curriculo_id IS NOT NULL THEN
    UPDATE curso_curriculos
    SET status = 'archived',
        updated_at = now()
    WHERE escola_id = p_escola_id
      AND ano_letivo_id = p_ano_letivo_id
      AND status = 'published'
      AND id != v_curriculo_id;

    UPDATE curso_curriculos
    SET status = 'published',
        updated_at = now()
    WHERE id = v_curriculo_id
      AND escola_id = p_escola_id;

    INSERT INTO turma_disciplinas (id, escola_id, turma_id, disciplina_id, professor_id)
    SELECT
      gen_random_uuid(),
      t.escola_id,
      t.id,
      ci.disciplina_id,
      NULL
    FROM turmas t
    JOIN curriculo_itens ci
      ON ci.escola_id = t.escola_id
      AND ci.curso_curriculo_id = v_curriculo_id
    WHERE t.escola_id = p_escola_id
      AND t.ano_letivo_id = p_ano_letivo_id
    ON CONFLICT (escola_id, turma_id, disciplina_id) DO NOTHING;

    v_applied := v_applied || jsonb_build_array(jsonb_build_object(
      'entidade', 'curso_curriculos',
      'operacao', 'publish',
      'curriculo_id', v_curriculo_id
    ));
  END IF;

  INSERT INTO audit_logs (
    escola_id, actor_id, action,
    entity, portal, details
  ) VALUES (
    p_escola_id,
    p_user_id,
    'CONFIG_COMMIT',
    'academic_setup',
    'admin',
    jsonb_build_object(
      'idempotency_key', p_idempotency_key,
      'idempotency_result', 'processed',
      'ano_letivo_id', p_ano_letivo_id,
      'changes', p_changes,
      'applied', v_applied,
      'diff', v_preview -> 'diff'
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'applied', v_applied,
    'diff', v_preview -> 'diff',
    'impact', v_preview -> 'impact'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok', false,
    'error', SQLERRM
  );
END;
$$;

REVOKE ALL ON FUNCTION public.preview_apply_changes FROM PUBLIC;
REVOKE ALL ON FUNCTION public.config_commit FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.preview_apply_changes TO authenticated;
GRANT EXECUTE ON FUNCTION public.config_commit TO authenticated;

COMMENT ON FUNCTION public.preview_apply_changes IS
  'Simula mudanças académicas e devolve diff + validações P0/P1 + impacto real. Read-only.';

COMMENT ON FUNCTION public.config_commit IS
  'Aplica mudanças académicas com transação real. Requer preview sem blockers. Idempotente por chave.';

COMMIT;
