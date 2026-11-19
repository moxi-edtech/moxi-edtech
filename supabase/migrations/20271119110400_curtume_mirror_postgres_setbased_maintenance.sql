-- One-off, internal Postgres-only set-based transfer of signed 2025 Curtume finals.
-- Keeps the exact same source filters and trigger checks as the previous row RPC.
BEGIN;
CREATE OR REPLACE FUNCTION public.curtume_2025_espelhar_notas_finais_manutencao(
  p_escola_id uuid, p_limite integer DEFAULT 500
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE
  v_school CONSTANT uuid:='3744879f-2e19-4671-8995-78604302d8c5';
  v_period uuid; v_stage integer; v_added integer; v_restantes integer;
BEGIN
  IF session_user IS DISTINCT FROM 'postgres' OR current_user IS DISTINCT FROM 'postgres'
    OR p_escola_id IS DISTINCT FROM v_school THEN
    RAISE EXCEPTION 'POSTGRES_MAINTENANCE_ONLY' USING ERRCODE='42501';
  END IF;
  IF p_limite IS NULL OR p_limite NOT BETWEEN 1 AND 600 THEN
    RAISE EXCEPTION 'INVALID_BATCH_LIMIT' USING ERRCODE='22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('curtume2025:historico_final:notas',0));
  SELECT pl.id INTO STRICT v_period FROM public.periodos_letivos pl
  JOIN public.anos_letivos y ON y.id=pl.ano_letivo_id AND y.escola_id=pl.escola_id
  WHERE pl.escola_id=v_school AND y.ano=2025 AND y.ativo=false
    AND pl.tipo='TRIMESTRE' AND pl.numero=3 AND pl.offering_id IS NULL;

  DROP TABLE IF EXISTS pg_temp.curtume_mfd_stage;
  CREATE TEMP TABLE curtume_mfd_stage ON COMMIT DROP AS
    SELECT h.id h_id, hd.id hd_id, h.matricula_id, hd.nota_final,
      hd.notas_detalhe->>'arquivo' documento, td.id td_id,c.numero classe_num
    FROM public.historico_anos h
    JOIN public.historico_disciplinas hd ON hd.historico_ano_id=h.id
    JOIN public.matriculas m ON m.id=h.matricula_id AND m.escola_id=h.escola_id
    JOIN public.turmas t ON t.id=h.turma_id AND t.escola_id=h.escola_id
    JOIN public.classes c ON c.id=t.classe_id AND c.escola_id=h.escola_id
    JOIN public.turma_disciplinas td ON td.turma_id=t.id AND td.escola_id=t.escola_id
    JOIN public.curso_matriz cm ON cm.id=td.curso_matriz_id AND cm.escola_id=td.escola_id
      AND cm.disciplina_id=hd.disciplina_id
    WHERE h.escola_id=v_school AND h.ano_letivo=2025
      AND h.snapshot_status='fechado' AND h.resultado_final IN ('aprovado','reprovado','concluido')
      AND m.ano_letivo=2025 AND m.session_id=h.ano_letivo_id
      AND m.turma_id=h.turma_id AND m.aluno_id=h.aluno_id
      AND m.status='concluido' AND m.ativo=false
      AND m.status_fecho_origem='override_admin'
      AND t.ano_letivo=2025 AND t.session_id=h.ano_letivo_id
      AND c.numero BETWEEN 1 AND 12
      AND hd.nota_final BETWEEN 0 AND CASE WHEN c.numero<=6 THEN 10 ELSE 20 END
      AND hd.notas_detalhe->>'ano_letivo' IN ('2025','2025/2026')
      AND nullif(btrim(hd.notas_detalhe->>'arquivo'),'') IS NOT NULL
      AND nullif(btrim(hd.notas_detalhe->>'aba'),'') IS NOT NULL
      AND nullif(btrim(hd.notas_detalhe->>'linha'),'') IS NOT NULL
      AND hd.notas_detalhe->>'arquivo' !~* '(2023[-_/ ]?24|2023[-_/ ]?2024)'
      AND EXISTS (SELECT 1 FROM public.historico_snapshot_locks l
        WHERE l.escola_id=h.escola_id AND l.matricula_id=m.id
          AND l.historico_ano_id=h.id AND l.ano_letivo_id=h.ano_letivo_id
          AND l.status='fechado')
      AND NOT EXISTS (
        SELECT 1 FROM public.notas n
        JOIN public.avaliacoes a ON a.id=n.avaliacao_id AND a.escola_id=n.escola_id
        WHERE n.escola_id=h.escola_id AND n.matricula_id=m.id
          AND a.tipo='HIST_FINAL' AND a.turma_disciplina_id=td.id)
    ORDER BY hd.id
    LIMIT p_limite
    FOR UPDATE OF hd SKIP LOCKED;
  SELECT count(*) INTO v_stage FROM pg_temp.curtume_mfd_stage;
  IF v_stage=0 THEN
    RETURN jsonb_build_object('ok',true,'criadas',0,'restantes',
      (public.curtume_2025_prever_espelhamento_notas(v_school)->>'elegiveis')::integer);
  END IF;
  IF v_stage<>(
    SELECT count(DISTINCT hd_id) FROM pg_temp.curtume_mfd_stage)
    OR v_stage<>(SELECT count(DISTINCT (matricula_id,td_id)) FROM pg_temp.curtume_mfd_stage)
    THEN RAISE EXCEPTION 'DUPLICATE_HISTORICAL_SOURCE'; END IF;

  PERFORM pg_catalog.set_config('klasse.curtume_2025_mirror','on',true);
  INSERT INTO public.avaliacoes
    (escola_id,turma_disciplina_id,periodo_letivo_id,ano_letivo,trimestre,nome,tipo,peso,nota_max)
  SELECT DISTINCT v_school,s.td_id,v_period,2025,3,
    'Final histórico (pauta)','HIST_FINAL',0,
    CASE WHEN s.classe_num<=6 THEN 10 ELSE 20 END
  FROM pg_temp.curtume_mfd_stage s
  ON CONFLICT (escola_id,turma_disciplina_id,ano_letivo,trimestre,tipo) DO NOTHING;

  INSERT INTO public.notas(escola_id,avaliacao_id,matricula_id,valor,metadata,updated_by)
  SELECT v_school,a.id,s.matricula_id,s.nota_final,
    jsonb_build_object('fonte','historico_disciplinas','tipo_nota','HIST_FINAL',
      'historico_ano_id',s.h_id,'historico_disciplina_id',s.hd_id,
      'documento',s.documento,'ano_letivo',2025,
      'sincronizado_em',now()),NULL::uuid
  FROM pg_temp.curtume_mfd_stage s
  JOIN public.avaliacoes a
    ON a.escola_id=v_school AND a.turma_disciplina_id=s.td_id
     AND a.ano_letivo=2025 AND a.trimestre=3 AND a.tipo='HIST_FINAL'
     AND a.periodo_letivo_id=v_period AND a.peso=0
     AND a.nota_max=CASE WHEN s.classe_num<=6 THEN 10 ELSE 20 END
  ON CONFLICT (escola_id,matricula_id,avaliacao_id) DO NOTHING;
  GET DIAGNOSTICS v_added=ROW_COUNT;
  IF v_added IS DISTINCT FROM v_stage THEN
    RAISE EXCEPTION 'MIRROR_BATCH_NOT_ATOMIC staged=% inserted=%',v_stage,v_added;
  END IF;
  PERFORM pg_catalog.set_config('klasse.curtume_2025_mirror','',true);

  INSERT INTO public.audit_logs(escola_id,actor_id,action,entity,entity_id,portal,details)
  VALUES(v_school,NULL,'CURTUME_2025_NOTAS_FINAIS_ESPELHADAS',
    'historico_disciplinas',v_school::text,'secretaria',
    jsonb_build_object('ano_letivo',2025,'tipo_avaliacao','HIST_FINAL',
      'criadas',v_added,'executor','supabase_postgres_maintenance',
      'processamento','set_based_sourced_and_legally_locked',
      'sem_fabricar_trimestres',true));
  v_restantes:=(public.curtume_2025_prever_espelhamento_notas(v_school)->>'elegiveis')::integer;
  RETURN jsonb_build_object('ok',true,'criadas',v_added,'restantes',v_restantes);
END;
$fn$;
REVOKE ALL ON FUNCTION public.curtume_2025_espelhar_notas_finais_manutencao(uuid,integer)
  FROM PUBLIC,anon,authenticated;
COMMIT;
