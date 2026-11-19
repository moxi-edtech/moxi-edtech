-- Tight postgres-only management execution for user-authorized Curtume academic synchronization.
BEGIN;
CREATE OR REPLACE FUNCTION public.curtume_2025_mfd_mirror_valid(
  p_escola_id uuid, p_matricula_id uuid, p_avaliacao_id uuid,
  p_valor numeric, p_metadata jsonb
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $fn$
  -- Fast-path: ordinary grades in any school never run the historic joins.
  SELECT CASE
    WHEN p_escola_id IS DISTINCT FROM '3744879f-2e19-4671-8995-78604302d8c5'::uuid
      OR p_metadata->>'tipo_nota' IS DISTINCT FROM 'HIST_FINAL'
      OR p_metadata->>'fonte' IS DISTINCT FROM 'historico_disciplinas'
      THEN false
    ELSE EXISTS(
      SELECT 1 FROM public.historico_anos h
      JOIN public.matriculas m ON m.id=h.matricula_id AND m.escola_id=h.escola_id
      JOIN public.historico_disciplinas hd ON hd.historico_ano_id=h.id
      JOIN public.avaliacoes a ON a.id=p_avaliacao_id AND a.escola_id=h.escola_id
      JOIN public.turma_disciplinas td ON td.id=a.turma_disciplina_id AND td.escola_id=a.escola_id
      JOIN public.curso_matriz cm ON cm.id=td.curso_matriz_id AND cm.escola_id=td.escola_id
      JOIN public.turmas t ON t.id=td.turma_id AND t.escola_id=td.escola_id
      JOIN public.classes c ON c.id=t.classe_id AND c.escola_id=t.escola_id
      JOIN public.periodos_letivos pl ON pl.id=a.periodo_letivo_id AND pl.escola_id=a.escola_id
      WHERE h.escola_id=p_escola_id AND h.matricula_id=p_matricula_id
        AND h.ano_letivo=2025 AND h.snapshot_status='fechado'
        AND h.resultado_final IN ('aprovado','reprovado','concluido')
        AND m.status='concluido' AND m.ativo=false
        AND m.status_fecho_origem='override_admin'
        AND m.aluno_id=h.aluno_id AND m.ano_letivo=2025
        AND m.session_id=h.ano_letivo_id AND m.turma_id=h.turma_id
        AND t.id=h.turma_id AND t.session_id=h.ano_letivo_id AND t.ano_letivo=2025
        AND cm.disciplina_id=hd.disciplina_id
        AND a.tipo='HIST_FINAL' AND a.ano_letivo=2025
        AND a.trimestre=3 AND pl.ano_letivo_id=h.ano_letivo_id
        AND pl.tipo='TRIMESTRE' AND pl.numero=3
        AND c.numero BETWEEN 1 AND 12
        AND a.nota_max=CASE WHEN c.numero<=6 THEN 10 ELSE 20 END
        AND hd.nota_final=p_valor AND p_valor BETWEEN 0 AND a.nota_max
        AND p_metadata->>'historico_ano_id'=h.id::text
        AND p_metadata->>'historico_disciplina_id'=hd.id::text
        AND p_metadata->>'documento'=hd.notas_detalhe->>'arquivo'
        AND hd.notas_detalhe->>'ano_letivo' IN ('2025','2025/2026')
        AND nullif(btrim(hd.notas_detalhe->>'arquivo'),'') IS NOT NULL
        AND nullif(btrim(hd.notas_detalhe->>'aba'),'') IS NOT NULL
        AND nullif(btrim(hd.notas_detalhe->>'linha'),'') IS NOT NULL
        AND hd.notas_detalhe->>'arquivo' !~* '(2023[-_/ ]?24|2023[-_/ ]?2024)'
        AND EXISTS (
          SELECT 1 FROM public.historico_snapshot_locks l
          WHERE l.escola_id=h.escola_id AND l.matricula_id=m.id
            AND l.historico_ano_id=h.id AND l.ano_letivo_id=m.session_id
            AND l.status='fechado'
        )
    )
  END;
$fn$;

CREATE OR REPLACE FUNCTION public.curtume_2025_pode_espelhar_nota(
  p_escola_id uuid,p_matricula_id uuid,p_avaliacao_id uuid,
  p_valor numeric,p_metadata jsonb
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth'
AS $fn$
  SELECT current_setting('klasse.curtume_2025_mirror',true)='on'
    AND p_escola_id='3744879f-2e19-4671-8995-78604302d8c5'::uuid
    AND ( (session_user='postgres' AND current_user='postgres')
      OR (public.safe_auth_uid() IS NOT NULL
        AND public.current_tenant_escola_id()=p_escola_id
        AND EXISTS(
          SELECT 1 FROM public.escola_users eu
          WHERE eu.escola_id=p_escola_id AND eu.user_id=public.safe_auth_uid()
            AND eu.papel IN ('admin','admin_escola','diretor','admin_secretaria','admin_secretario','admin_financeiro')
        ))
    )
    AND public.curtume_2025_mfd_mirror_valid(
      p_escola_id,p_matricula_id,p_avaliacao_id,p_valor,p_metadata);
$fn$;

CREATE OR REPLACE FUNCTION public.curtume_2025_pode_criar_avaliacao_final(
  p_escola_id uuid,p_td uuid,p_periodo uuid,p_ano integer,p_tipo text,p_trim integer
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog','public','auth'
AS $fn$
 SELECT current_setting('klasse.curtume_2025_mirror',true)='on'
   AND p_escola_id='3744879f-2e19-4671-8995-78604302d8c5'::uuid
   AND p_ano=2025 AND p_tipo='HIST_FINAL' AND p_trim=3
   AND ((session_user='postgres' AND current_user='postgres')
      OR (public.safe_auth_uid() IS NOT NULL
          AND public.current_tenant_escola_id()=p_escola_id
          AND EXISTS(
            SELECT 1 FROM public.escola_users eu
            WHERE eu.escola_id=p_escola_id AND eu.user_id=public.safe_auth_uid()
              AND eu.papel IN ('admin','admin_escola','diretor','admin_secretaria','admin_secretario','admin_financeiro')
          )))
   AND EXISTS (
      SELECT 1 FROM public.turma_disciplinas td
      JOIN public.turmas t ON t.id=td.turma_id AND t.escola_id=td.escola_id
      JOIN public.curso_matriz cm ON cm.id=td.curso_matriz_id AND cm.escola_id=td.escola_id
      JOIN public.periodos_letivos pl ON pl.id=p_periodo AND pl.escola_id=td.escola_id
      JOIN public.historico_anos h ON h.escola_id=td.escola_id AND h.turma_id=t.id
      JOIN public.historico_disciplinas hd ON hd.historico_ano_id=h.id AND hd.disciplina_id=cm.disciplina_id
      WHERE td.id=p_td AND td.escola_id=p_escola_id
        AND t.ano_letivo=2025 AND t.session_id=h.ano_letivo_id
        AND pl.ano_letivo_id=h.ano_letivo_id AND pl.tipo='TRIMESTRE' AND pl.numero=3
        AND h.snapshot_status='fechado' AND h.resultado_final IS NOT NULL
        AND hd.nota_final IS NOT NULL
        AND hd.notas_detalhe->>'ano_letivo' IN ('2025','2025/2026')
        AND hd.notas_detalhe->>'arquivo' !~* '(2023[-_/ ]?24|2023[-_/ ]?2024)'
        AND EXISTS(SELECT 1 FROM public.historico_snapshot_locks l
          WHERE l.escola_id=h.escola_id AND l.historico_ano_id=h.id
            AND l.matricula_id=h.matricula_id AND l.ano_letivo_id=h.ano_letivo_id
            AND l.status='fechado')
    );
$fn$;

CREATE OR REPLACE FUNCTION public.curtume_2025_prever_espelhamento_notas(p_escola_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth'
AS $fn$
DECLARE v_actor uuid:=public.safe_auth_uid(); v_result jsonb;
BEGIN
 IF p_escola_id IS DISTINCT FROM '3744879f-2e19-4671-8995-78604302d8c5'::uuid
      OR ((v_actor IS NULL OR p_escola_id IS DISTINCT FROM '3744879f-2e19-4671-8995-78604302d8c5'::uuid
   OR public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id
   OR NOT EXISTS (SELECT 1 FROM public.escola_users eu WHERE eu.escola_id=p_escola_id
     AND eu.user_id=v_actor AND eu.papel IN
       ('admin','admin_escola','diretor','admin_secretaria','admin_secretario','admin_financeiro'))) AND NOT (session_user='postgres' AND current_user='postgres')) THEN
   RAISE EXCEPTION 'AUTH: sincronização histórica reservada à direção/secretaria académica'
      USING ERRCODE='42501';
 END IF;
 WITH src AS (
   SELECT h.id h_id,h.snapshot_status,h.ano_letivo_id,h.matricula_id,
     hd.id hd_id,hd.disciplina_id,hd.nota_final,hd.notas_detalhe,
     m.status AS matricula_status,m.status_fecho_origem,m.ativo,m.session_id,m.turma_id,
     t.ano_letivo AS turma_ano,t.session_id AS turma_session,c.numero classe_num,
     td.id AS turma_disciplina_id,
     EXISTS(SELECT 1 FROM public.historico_snapshot_locks l WHERE
       l.escola_id=h.escola_id AND l.historico_ano_id=h.id
       AND l.matricula_id=h.matricula_id AND l.ano_letivo_id=h.ano_letivo_id
       AND l.status='fechado') legal_lock
   FROM public.historico_anos h
   JOIN public.historico_disciplinas hd ON hd.historico_ano_id=h.id
   LEFT JOIN public.matriculas m ON m.id=h.matricula_id AND m.escola_id=h.escola_id
   LEFT JOIN public.turmas t ON t.id=h.turma_id AND t.escola_id=h.escola_id
   LEFT JOIN public.classes c ON c.id=t.classe_id AND c.escola_id=h.escola_id
   LEFT JOIN public.turma_disciplinas td ON td.escola_id=h.escola_id AND td.turma_id=h.turma_id
      AND EXISTS(SELECT 1 FROM public.curso_matriz cm
       WHERE cm.id=td.curso_matriz_id AND cm.escola_id=td.escola_id
         AND cm.disciplina_id=hd.disciplina_id)
   WHERE h.escola_id=p_escola_id AND h.ano_letivo=2025
 ), flags AS (
   SELECT s.*,
     (s.notas_detalhe->>'arquivo') ~* '(2023[-_/ ]?24|2023[-_/ ]?2024)' AS doc_divergente,
     s.nota_final BETWEEN 0 AND CASE WHEN s.classe_num<=6 THEN 10 ELSE 20 END AS escala_valida,
     s.notas_detalhe->>'ano_letivo' IN ('2025','2025/2026')
        AND nullif(btrim(s.notas_detalhe->>'arquivo'),'') IS NOT NULL
        AND nullif(btrim(s.notas_detalhe->>'aba'),'') IS NOT NULL
        AND nullif(btrim(s.notas_detalhe->>'linha'),'') IS NOT NULL AS fonte_completa,
     EXISTS(
       SELECT 1 FROM public.notas n
       JOIN public.avaliacoes a ON a.id=n.avaliacao_id AND a.escola_id=n.escola_id
       WHERE n.escola_id=p_escola_id AND n.matricula_id=s.matricula_id
         AND a.tipo='HIST_FINAL' AND a.turma_disciplina_id=s.turma_disciplina_id
     ) as espelho_existente,
     EXISTS(
       SELECT 1 FROM public.notas n
       JOIN public.avaliacoes a ON a.id=n.avaliacao_id AND a.escola_id=n.escola_id
       WHERE n.escola_id=p_escola_id AND n.matricula_id=s.matricula_id
         AND a.tipo='HIST_FINAL' AND a.turma_disciplina_id=s.turma_disciplina_id
         AND public.curtume_2025_mfd_mirror_valid(
           n.escola_id,n.matricula_id,n.avaliacao_id,n.valor,n.metadata)
     ) as ja_migrada
   FROM src s
 ), classes AS (
   SELECT *,
     CASE
      WHEN snapshot_status<>'fechado' THEN 'historico_aberto'
      WHEN doc_divergente THEN 'documento_ano_divergente'
      WHEN NOT legal_lock OR matricula_status IS DISTINCT FROM 'concluido'
       OR status_fecho_origem IS DISTINCT FROM 'override_admin' OR ativo IS DISTINCT FROM false
       OR session_id IS DISTINCT FROM ano_letivo_id
       OR turma_id IS DISTINCT FROM (SELECT h.turma_id FROM public.historico_anos h WHERE h.id=h_id)
       OR turma_session IS DISTINCT FROM ano_letivo_id OR turma_ano IS DISTINCT FROM 2025
       OR classe_num NOT BETWEEN 1 AND 12 OR turma_disciplina_id IS NULL
       OR nota_final IS NULL OR NOT escala_valida OR NOT fonte_completa
        THEN 'inconsistencia'
      WHEN espelho_existente AND NOT ja_migrada THEN 'inconsistencia'
      WHEN ja_migrada THEN 'sincronizada'
      ELSE 'elegivel' END AS categoria
   FROM flags
 )
 SELECT jsonb_build_object('ok',true,'ano',2025,'total',count(*),
  'elegiveis',count(*) FILTER(WHERE categoria='elegivel'),
  'sincronizadas',count(*) FILTER(WHERE categoria='sincronizada'),
  'documento_ano_divergente',count(*) FILTER(WHERE categoria='documento_ano_divergente'),
  'historico_aberto',count(*) FILTER(WHERE categoria='historico_aberto'),
  'inconsistencias',count(*) FILTER(WHERE categoria='inconsistencia'))
 INTO v_result FROM classes;
 RETURN v_result;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.curtume_2025_espelhar_notas_finais(
  p_escola_id uuid,p_limite integer DEFAULT 80
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth'
AS $fn$
DECLARE
  v_actor uuid:=public.safe_auth_uid();
  v_source record; v_avaliacao uuid; v_count integer; v_saved integer:=0;
  v_escala integer; v_period uuid;
BEGIN
  IF p_escola_id IS DISTINCT FROM '3744879f-2e19-4671-8995-78604302d8c5'::uuid
      OR ((v_actor IS NULL OR p_escola_id IS DISTINCT FROM '3744879f-2e19-4671-8995-78604302d8c5'::uuid
     OR public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id
     OR NOT EXISTS (SELECT 1 FROM public.escola_users eu WHERE eu.escola_id=p_escola_id
       AND eu.user_id=v_actor AND eu.papel IN
         ('admin','admin_escola','diretor','admin_secretaria','admin_secretario','admin_financeiro'))) AND NOT (session_user='postgres' AND current_user='postgres')) THEN
    RAISE EXCEPTION 'AUTH: sincronização histórica não autorizada' USING ERRCODE='42501';
  END IF;
  IF p_limite IS NULL OR p_limite NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'DATA: limite inválido' USING ERRCODE='22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('curtume2025:historico_final:notas',0));
  SELECT pl.id INTO v_period
  FROM public.periodos_letivos pl JOIN public.anos_letivos y
    ON y.id=pl.ano_letivo_id AND y.escola_id=pl.escola_id
  WHERE pl.escola_id=p_escola_id AND y.ano=2025 AND y.ativo=false
    AND pl.tipo='TRIMESTRE' AND pl.numero=3 AND pl.offering_id IS NULL;
  IF v_period IS NULL THEN
    RAISE EXCEPTION 'SYNC_PERIOD_NOT_FOUND: terceiro trimestre 2025/26 não configurado';
  END IF;
  PERFORM pg_catalog.set_config('klasse.curtume_2025_mirror','on',true);
  FOR v_source IN
    SELECT h.id h_id,hd.id hd_id,hd.disciplina_id,h.matricula_id,hd.nota_final,
       hd.notas_detalhe->>'arquivo' documento,
       td.id td_id,c.numero classe_num
    FROM public.historico_anos h
    JOIN public.historico_disciplinas hd ON hd.historico_ano_id=h.id
    JOIN public.matriculas m ON m.id=h.matricula_id AND m.escola_id=h.escola_id
    JOIN public.turmas t ON t.id=h.turma_id AND t.escola_id=h.escola_id
    JOIN public.classes c ON c.id=t.classe_id AND c.escola_id=h.escola_id
    JOIN public.turma_disciplinas td ON td.turma_id=t.id AND td.escola_id=t.escola_id
    JOIN public.curso_matriz cm ON cm.id=td.curso_matriz_id AND cm.escola_id=td.escola_id
      AND cm.disciplina_id=hd.disciplina_id
    WHERE h.escola_id=p_escola_id AND h.ano_letivo=2025
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
    FOR UPDATE OF hd SKIP LOCKED
  LOOP
    v_escala:=CASE WHEN v_source.classe_num<=6 THEN 10 ELSE 20 END;
    INSERT INTO public.avaliacoes
      (escola_id,turma_disciplina_id,periodo_letivo_id,ano_letivo,trimestre,nome,tipo,peso,nota_max)
    VALUES(p_escola_id,v_source.td_id,v_period,2025,3,
      'Final histórico (pauta)', 'HIST_FINAL',0,v_escala)
    ON CONFLICT (escola_id,turma_disciplina_id,ano_letivo,trimestre,tipo) DO NOTHING;
    SELECT id INTO v_avaliacao FROM public.avaliacoes a
     WHERE a.escola_id=p_escola_id AND a.turma_disciplina_id=v_source.td_id
       AND a.ano_letivo=2025 AND a.trimestre=3 AND a.tipo='HIST_FINAL';
    IF v_avaliacao IS NULL THEN RAISE EXCEPTION 'SYNC_ASSESSMENT_MISSING'; END IF;
    INSERT INTO public.notas(escola_id,avaliacao_id,matricula_id,valor,metadata,updated_by)
    VALUES(p_escola_id,v_avaliacao,v_source.matricula_id,v_source.nota_final,
      jsonb_build_object('fonte','historico_disciplinas','tipo_nota','HIST_FINAL',
        'historico_ano_id',v_source.h_id,'historico_disciplina_id',v_source.hd_id,
        'documento',v_source.documento,'ano_letivo',2025,
        'sincronizado_em',now()),v_actor)
    ON CONFLICT (escola_id,matricula_id,avaliacao_id) DO NOTHING;
    GET DIAGNOSTICS v_count=ROW_COUNT;
    v_saved:=v_saved+v_count;
  END LOOP;
  PERFORM pg_catalog.set_config('klasse.curtume_2025_mirror','',true);
  IF v_saved>0 THEN
    INSERT INTO public.audit_logs(escola_id,actor_id,action,entity,entity_id,portal,details)
    VALUES(p_escola_id,v_actor,'CURTUME_2025_NOTAS_FINAIS_ESPELHADAS',
      'historico_disciplinas',p_escola_id::text,'secretaria',
      jsonb_build_object('ano_letivo',2025,'tipo_avaliacao','HIST_FINAL',
        'criadas',v_saved,'executor',CASE WHEN v_actor IS NULL THEN 'supabase_postgres_maintenance' ELSE 'authenticated_staff' END,'sem_fabricar_trimestres',true));
  END IF;
  RETURN jsonb_build_object('ok',true,'criadas',v_saved,
    'restantes',(public.curtume_2025_prever_espelhamento_notas(p_escola_id)->>'elegiveis')::integer);
END;
$fn$;
COMMIT;
