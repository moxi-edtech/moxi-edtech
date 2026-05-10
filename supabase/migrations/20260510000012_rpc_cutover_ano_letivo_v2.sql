-- Migration: 20260510000012_rpc_cutover_ano_letivo_v2.sql
-- Descricao: Virada transacional de ano letivo com reconciliacao de mensalidades por estrategia.

BEGIN;

CREATE OR REPLACE FUNCTION public.cutover_ano_letivo_v2(
    p_escola_id uuid,
    p_from_session_id uuid,
    p_to_session_id uuid,
    p_conflict_strategy text DEFAULT 'skip'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_escola_id uuid := public.current_tenant_escola_id();
    v_has_permission boolean;
    v_from_ano int;
    v_to_ano int;
    v_to_inicio date;
    v_to_fim date;
    v_updated_turmas int := 0;
    v_updated_matriculas int := 0;
    v_updated_mensalidades_ano int := 0;
    v_updated_mensalidades_competencia int := 0;
    v_conflicts int := 0;
    v_deleted_conflicts int := 0;
    v_actor_id uuid := auth.uid();
BEGIN
    IF v_tenant_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_tenant_escola_id THEN
        RAISE EXCEPTION 'AUTH: escola_id invalido.';
    END IF;

    SELECT public.user_has_role_in_school(v_tenant_escola_id, ARRAY['admin', 'admin_escola'])
    INTO v_has_permission;
    IF NOT v_has_permission THEN
        RAISE EXCEPTION 'AUTH: permissao negada.';
    END IF;

    IF p_from_session_id = p_to_session_id THEN
        RAISE EXCEPTION 'VALIDATION: sessoes de origem e destino devem ser diferentes.';
    END IF;

    SELECT ano INTO v_from_ano
    FROM public.anos_letivos
    WHERE id = p_from_session_id AND escola_id = p_escola_id
    FOR UPDATE;

    SELECT ano, data_inicio, data_fim INTO v_to_ano, v_to_inicio, v_to_fim
    FROM public.anos_letivos
    WHERE id = p_to_session_id AND escola_id = p_escola_id
    FOR UPDATE;

    IF v_from_ano IS NULL OR v_to_ano IS NULL THEN
        RAISE EXCEPTION 'VALIDATION: ano letivo de origem/destino invalido.';
    END IF;

    IF p_conflict_strategy NOT IN ('skip', 'merge', 'cancel') THEN
        RAISE EXCEPTION 'VALIDATION: conflict_strategy invalida (%).', p_conflict_strategy;
    END IF;

    UPDATE public.turmas
    SET session_id = p_to_session_id,
        ano_letivo_id = p_to_session_id,
        ano_letivo = v_to_ano,
        updated_at = now()
    WHERE escola_id = p_escola_id
      AND (session_id = p_from_session_id OR ano_letivo_id = p_from_session_id);
    GET DIAGNOSTICS v_updated_turmas = ROW_COUNT;

    UPDATE public.matriculas
    SET session_id = p_to_session_id,
        ano_letivo = v_to_ano,
        updated_at = now()
    WHERE escola_id = p_escola_id
      AND session_id = p_from_session_id;
    GET DIAGNOSTICS v_updated_matriculas = ROW_COUNT;

    -- Primeiro passo: alinhar ano_letivo textual da mensalidade
    UPDATE public.mensalidades m
    SET ano_letivo = v_to_ano::text,
        updated_at = now()
    WHERE m.escola_id = p_escola_id
      AND (
        m.ano_letivo = v_from_ano::text
        OR EXISTS (
          SELECT 1
          FROM public.matriculas mat
          WHERE mat.id = m.matricula_id AND mat.escola_id = p_escola_id AND mat.session_id = p_to_session_id
        )
      );
    GET DIAGNOSTICS v_updated_mensalidades_ano = ROW_COUNT;

    -- Segundo passo: reancorar competencia (ano_referencia) dentro da janela do ano ativo destino
    WITH out_of_window AS (
      SELECT
        m.id,
        CASE
          WHEN m.mes_referencia >= EXTRACT(MONTH FROM v_to_inicio)::int
            THEN EXTRACT(YEAR FROM v_to_inicio)::int
          ELSE EXTRACT(YEAR FROM v_to_fim)::int
        END AS target_year
      FROM public.mensalidades m
      WHERE m.escola_id = p_escola_id
        AND make_date(m.ano_referencia, m.mes_referencia::int, 1)
          NOT BETWEEN v_to_inicio AND v_to_fim
    ), conflict_rows AS (
      SELECT ow.id
      FROM out_of_window ow
      JOIN public.mensalidades x
        ON x.escola_id = p_escola_id
       AND x.matricula_id = (SELECT mm.matricula_id FROM public.mensalidades mm WHERE mm.id = ow.id)
       AND x.ano_referencia = ow.target_year
       AND x.mes_referencia = (SELECT mm.mes_referencia FROM public.mensalidades mm WHERE mm.id = ow.id)
       AND x.id <> ow.id
    ), to_update AS (
      SELECT ow.*
      FROM out_of_window ow
      LEFT JOIN conflict_rows c ON c.id = ow.id
      WHERE c.id IS NULL
    )
    UPDATE public.mensalidades m
    SET ano_referencia = u.target_year,
        updated_at = now()
    FROM to_update u
    WHERE m.id = u.id;
    GET DIAGNOSTICS v_updated_mensalidades_competencia = ROW_COUNT;

    WITH out_of_window AS (
      SELECT
        m.id,
        m.matricula_id,
        m.mes_referencia,
        CASE
          WHEN m.mes_referencia >= EXTRACT(MONTH FROM v_to_inicio)::int
            THEN EXTRACT(YEAR FROM v_to_inicio)::int
          ELSE EXTRACT(YEAR FROM v_to_fim)::int
        END AS target_year
      FROM public.mensalidades m
      WHERE m.escola_id = p_escola_id
        AND make_date(m.ano_referencia, m.mes_referencia::int, 1)
          NOT BETWEEN v_to_inicio AND v_to_fim
    )
    SELECT count(*) INTO v_conflicts
    FROM out_of_window ow
    WHERE EXISTS (
      SELECT 1
      FROM public.mensalidades x
      WHERE x.escola_id = p_escola_id
        AND x.matricula_id = ow.matricula_id
        AND x.ano_referencia = ow.target_year
        AND x.mes_referencia = ow.mes_referencia
        AND x.id <> ow.id
    );

    IF v_conflicts > 0 THEN
      IF p_conflict_strategy = 'skip' THEN
        NULL;
      ELSIF p_conflict_strategy = 'cancel' THEN
        WITH out_of_window AS (
          SELECT
            m.id,
            m.matricula_id,
            m.mes_referencia,
            CASE
              WHEN m.mes_referencia >= EXTRACT(MONTH FROM v_to_inicio)::int
                THEN EXTRACT(YEAR FROM v_to_inicio)::int
              ELSE EXTRACT(YEAR FROM v_to_fim)::int
            END AS target_year
          FROM public.mensalidades m
          WHERE m.escola_id = p_escola_id
            AND make_date(m.ano_referencia, m.mes_referencia::int, 1)
              NOT BETWEEN v_to_inicio AND v_to_fim
        ), to_delete AS (
          SELECT ow.id
          FROM out_of_window ow
          WHERE EXISTS (
            SELECT 1
            FROM public.mensalidades x
            WHERE x.escola_id = p_escola_id
              AND x.matricula_id = ow.matricula_id
              AND x.ano_referencia = ow.target_year
              AND x.mes_referencia = ow.mes_referencia
              AND x.id <> ow.id
          )
        )
        DELETE FROM public.mensalidades m
        USING to_delete d
        WHERE m.id = d.id;
        GET DIAGNOSTICS v_deleted_conflicts = ROW_COUNT;
      ELSIF p_conflict_strategy = 'merge' THEN
        RAISE EXCEPTION 'CONFLICT: estrategia merge requer reconciliacao financeira assistida (trigger ledger ativo).';
      END IF;
    END IF;

    UPDATE public.anos_letivos
    SET ativo = CASE WHEN id = p_to_session_id THEN true ELSE false END,
        updated_at = now()
    WHERE escola_id = p_escola_id;

    INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, details, portal)
    VALUES (
      p_escola_id,
      v_actor_id,
      'ANO_LETIVO_CUTOVER_V2',
      'anos_letivos',
      p_to_session_id::text,
      jsonb_build_object(
        'from_session_id', p_from_session_id,
        'to_session_id', p_to_session_id,
        'from_ano', v_from_ano,
        'to_ano', v_to_ano,
        'updated_turmas', v_updated_turmas,
        'updated_matriculas', v_updated_matriculas,
        'updated_mensalidades_ano', v_updated_mensalidades_ano,
        'updated_mensalidades_competencia', v_updated_mensalidades_competencia,
        'conflicts', v_conflicts,
        'deleted_conflicts', v_deleted_conflicts,
        'conflict_strategy', p_conflict_strategy,
        'at', now()
      ),
      'admin'
    );

    RETURN jsonb_build_object(
      'ok', true,
      'summary', jsonb_build_object(
        'updated_turmas', v_updated_turmas,
        'updated_matriculas', v_updated_matriculas,
        'updated_mensalidades_ano', v_updated_mensalidades_ano,
        'updated_mensalidades_competencia', v_updated_mensalidades_competencia,
        'conflicts', v_conflicts,
        'deleted_conflicts', v_deleted_conflicts,
        'conflict_strategy', p_conflict_strategy
      )
    );
END;
$$;

COMMIT;
