-- School-scoped, director-confirmed historical batch close. A past source's
-- history rows (not today's turma matrix) determine its subjects. This never
-- inserts marks, changes matriculas, or recomputes the school's signed outcome.
-- Each pupil is separately transactional: an error rolls back their audit
-- and lock while other pupils can still finish.
BEGIN;

CREATE OR REPLACE FUNCTION public.curtume_fechar_pautas_2025_lote(
    p_escola_id uuid,
    p_lote_id uuid,
    p_depois uuid DEFAULT NULL,
    p_limite integer DEFAULT 25)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $function$
DECLARE
  v_actor uuid := public.safe_auth_uid();
  v_role text;
  v_row record;
  v_count integer := 0;
  v_closed integer := 0;
  v_blocked integer := 0;
  v_cursor uuid := p_depois;
  v_errors jsonb := '[]'::jsonb;
  v_total integer;
  v_invalid integer;
  v_duplicate boolean;
  v_document text;
  v_aba text;
  v_linha text;
  v_ref text;
  v_reason text := 'Ratificação escolar em lote de médias finais da pauta histórica CURTUME 2025/2026.';
  v_scale numeric;
  v_class integer;
  v_regime jsonb;
  v_raa jsonb;
  v_expected text;
  v_error text;
  v_state text;
BEGIN
  -- Do not rely on service_role, arbitrary school IDs or expanded roles.
  IF p_escola_id IS DISTINCT FROM '3744879f-2e19-4671-8995-78604302d8c5'::uuid
     OR p_lote_id IS NULL
     OR p_limite IS NULL OR p_limite NOT BETWEEN 1 AND 30
     OR v_actor IS NULL
     OR public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id THEN
    RAISE EXCEPTION 'CURTUME_BATCH_FORBIDDEN' USING ERRCODE='42501';
  END IF;

  SELECT eu.papel INTO v_role FROM public.escola_users eu
    WHERE eu.escola_id=p_escola_id AND eu.user_id=v_actor
      AND eu.papel IN ('admin','admin_escola','diretor','staff_admin')
    LIMIT 1;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'CURTUME_BATCH_ROLE_FORBIDDEN' USING ERRCODE='42501';
  END IF;

  IF NOT pg_catalog.pg_try_advisory_xact_lock(
      pg_catalog.hashtext('curtume_pautas_2025:' || p_escola_id::text),
      2025) THEN
    RAISE EXCEPTION 'CURTUME_BATCH_IN_PROGRESS' USING ERRCODE='55P03';
  END IF;

  FOR v_row IN
    SELECT h.id AS historico_id, h.escola_id, h.aluno_id,
           h.matricula_id, h.ano_letivo_id, h.resultado_final, h.turma_id,
           m.session_id, m.status, m.ativo, m.status_fecho_origem,
           CASE WHEN c.nome='Pré-Escolar' THEN 0 ELSE c.numero END AS classe,
           a.numero_processo
      FROM public.historico_anos h
      JOIN public.matriculas m ON m.id=h.matricula_id AND m.escola_id=h.escola_id
      LEFT JOIN public.turmas t ON t.id=h.turma_id AND t.escola_id=h.escola_id
      LEFT JOIN public.classes c ON c.id=t.classe_id AND c.escola_id=h.escola_id
      LEFT JOIN public.alunos a ON a.id=h.aluno_id AND a.escola_id=h.escola_id
      WHERE h.escola_id=p_escola_id AND h.ano_letivo=2025
        AND h.snapshot_status='aberto'
        AND (p_depois IS NULL OR h.id>p_depois)
      ORDER BY h.id
      LIMIT p_limite
  LOOP
    v_cursor := v_row.historico_id;
    v_count := v_count + 1;
    -- The per-pupil PL/pgSQL subtransaction makes "ratify+lock+RAA-check"
    -- atomic without sacrificing other well-formed pupils in the same batch.
    BEGIN
      IF v_row.status <> 'concluido' OR v_row.ativo IS DISTINCT FROM false
         OR v_row.status_fecho_origem IS DISTINCT FROM 'override_admin'
         OR v_row.session_id IS NULL
         OR v_row.ano_letivo_id IS DISTINCT FROM v_row.session_id
         OR v_row.resultado_final NOT IN ('aprovado','reprovado','concluido')
         OR v_row.classe IS NULL THEN
        RAISE EXCEPTION 'ORIGEM_HISTORICA_INCOMPATIVEL'
          USING ERRCODE='23514';
      END IF;
      -- Live grade rows take precedence through the normal grade engine.
      -- Do not merge operational and imported grades invisibly.
      IF EXISTS(SELECT 1 FROM public.notas n
                WHERE n.escola_id=p_escola_id
                  AND n.matricula_id=v_row.matricula_id) THEN
        RAISE EXCEPTION 'NOTAS_OPERACIONAIS_EXIGEM_RECONCILIACAO'
          USING ERRCODE='23514';
      END IF;

      SELECT count(*), min(hd.notas_detalhe->>'arquivo'),
             min(hd.notas_detalhe->>'aba'),
             min(hd.notas_detalhe->>'linha'),
             count(*) FILTER(
                WHERE hd.disciplina_id IS NULL
                   OR nullif(btrim(hd.disciplina_nome),'') IS NULL
                   OR hd.nota_final IS NULL
                   OR hd.notas_detalhe->>'ano_letivo'
                       NOT IN ('2025','2025/2026')
                   OR hd.notas_detalhe->>'ano_letivo' IS NULL
                   OR nullif(btrim(hd.notas_detalhe->>'arquivo'),'') IS NULL
                   OR nullif(btrim(hd.notas_detalhe->>'aba'),'') IS NULL
                   OR nullif(btrim(hd.notas_detalhe->>'linha'),'') IS NULL
                   OR hd.notas_detalhe->>'fonte' NOT IN (
                       'pauta_fisica_excel','pauta_oficial_excel',
                       'pauta_escola_transcrita',
                       'pauta_escola_oficial_transcrita')
                   OR hd.notas_detalhe->>'fonte' IS NULL
                   OR (NULLIF(hd.notas_detalhe->>'numero_processo','') IS NOT NULL
                     AND (v_row.numero_processo IS NULL
                       OR ltrim(hd.notas_detalhe->>'numero_processo','0')
                          IS DISTINCT FROM ltrim(v_row.numero_processo,'0')))
                   OR hd.nota_final < 0
                   OR hd.nota_final > COALESCE(
                       CASE WHEN COALESCE(hd.notas_detalhe->>'escala_maxima',
                                          hd.notas_detalhe->>'escala') ~ '^[0-9]+([.][0-9]+)?$'
                            THEN COALESCE(hd.notas_detalhe->>'escala_maxima',
                                          hd.notas_detalhe->>'escala')::numeric
                       END,
                       CASE WHEN v_row.classe<=6 THEN 10 ELSE 20 END))
        INTO v_total,v_document,v_aba,v_linha,v_invalid
      FROM public.historico_disciplinas hd
      WHERE hd.historico_ano_id=v_row.historico_id;

      IF v_total=0 THEN
        RAISE EXCEPTION 'SEM_NOTAS_HISTORICAS' USING ERRCODE='23514';
      END IF;
      IF v_invalid>0 THEN
        RAISE EXCEPTION 'PAUTA_HISTORICA_INCONSISTENTE' USING ERRCODE='23514';
      END IF;
      SELECT EXISTS(
        SELECT 1 FROM public.historico_disciplinas hd
        WHERE hd.historico_ano_id=v_row.historico_id
        GROUP BY hd.disciplina_id HAVING count(*)>1)
        INTO v_duplicate;
      IF v_duplicate THEN
        RAISE EXCEPTION 'DISCIPLINA_DUPLICADA_NA_PAUTA'
          USING ERRCODE='23514';
      END IF;

      -- Names like '2023-24' in a legacy XLSX filename are not a reason to
      -- discard a 2025/2026 school import with explicit 2025 metadata.
      v_ref := left('PAUTA CURTUME 2025/2026: ' || v_document ||
                    ' | ' || v_aba || ' | linha ' || v_linha, 180);

      PERFORM public.ratificar_resultado_historico_escola(
        p_escola_id,v_row.matricula_id,v_row.resultado_final,
        v_ref,v_reason);
      PERFORM public.historico_set_snapshot_state(
        p_escola_id,ARRAY[v_row.matricula_id],v_row.session_id,
        'fechado','Fecho conforme pauta escolar importada CURTUME 2025/2026',
        p_lote_id);
      v_regime := public.resolve_regime_academico(v_row.turma_id);
      v_expected := CASE
        WHEN v_row.resultado_final='reprovado' THEN 'retido'
        WHEN v_row.resultado_final='concluido'
             OR (v_row.resultado_final='aprovado'
                 AND COALESCE((v_regime->>'eh_classe_exame')::boolean,false))
          THEN 'concluiu'
        ELSE 'transitou' END;
      v_raa := public.resolve_raa_progression_for_matricula(
         p_escola_id,v_row.matricula_id);
      IF v_raa->>'decision' IS DISTINCT FROM v_expected
         OR v_raa->>'fonte_decisao'
            IS DISTINCT FROM 'historico_documental_ratificado' THEN
        RAISE EXCEPTION 'RAA_RESULTADO_NAO_RECONHECIDO'
          USING ERRCODE='23514';
      END IF;
      v_closed := v_closed + 1;
    EXCEPTION WHEN OTHERS THEN
      v_blocked := v_blocked + 1;
      v_error := left(SQLERRM,150);
      v_state := SQLSTATE;
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'matricula_id',v_row.matricula_id,
        'codigo',split_part(v_error,':',1),
        'detalhe',v_error,
        'sqlstate',v_state));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'ok',true, 'lote_id',p_lote_id, 'processados',v_count,
    'fechados',v_closed, 'bloqueados',v_blocked,
    'cursor',v_cursor,
    'terminou',v_count<p_limite,
    'pendencias',v_errors);
END;
$function$;

REVOKE ALL ON FUNCTION public.curtume_fechar_pautas_2025_lote(
  uuid,uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.curtume_fechar_pautas_2025_lote(
  uuid,uuid,uuid,integer) TO authenticated;

COMMIT;
