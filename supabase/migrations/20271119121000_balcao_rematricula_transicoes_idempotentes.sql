-- Historical grade decisions remain signed and immutable.
-- Legitimate cross-cycle 6->7 and Pré->1 progressions plus read-only retry.
BEGIN;
CREATE OR REPLACE FUNCTION public.resolve_raa_progression_for_matricula(p_escola_id uuid, p_matricula_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_legal jsonb;
  v_authorized record;
  v_historic record;
  v_regime jsonb;
  v_terminale boolean;
BEGIN
  -- The final legal snapshot is the authority only for a documented
  -- school decision in a valid, approved 2025->2026 historical cohort.
  -- This branch never changes grades or automatically decides an outcome.
  IF public.safe_auth_uid() IS NOT NULL
     AND public.current_tenant_escola_id() IS NOT DISTINCT FROM p_escola_id
  THEN
    SELECT m.id AS matricula_id, m.turma_id, h.id AS historico_id,
           h.resultado_final AS resultado
      INTO v_historic
    FROM public.matriculas m
    JOIN public.historico_anos h
      ON h.escola_id=m.escola_id AND h.aluno_id=m.aluno_id
      AND h.matricula_id=m.id AND h.ano_letivo=m.ano_letivo
      AND h.ano_letivo_id=m.session_id
    WHERE m.escola_id=p_escola_id AND m.id=p_matricula_id
      AND m.status='concluido' AND m.ativo=false
      AND m.status_fecho_origem='override_admin'
      AND h.snapshot_status='fechado'
      AND h.resultado_final IN ('aprovado','reprovado','concluido')
      AND EXISTS (
        SELECT 1 FROM public.historico_snapshot_locks sl
        WHERE sl.escola_id=p_escola_id AND sl.matricula_id=m.id
          AND sl.ano_letivo_id=m.session_id AND sl.status='fechado'
          AND sl.historico_ano_id=h.id
      )
      AND (public.balcao_origem_percurso_elegivel(p_escola_id,p_matricula_id) OR EXISTS (
        SELECT 1 FROM public.academic_transition_cohort_members cm
        JOIN public.academic_transition_cohorts c
          ON c.id=cm.cohort_id AND c.escola_id=cm.escola_id
        WHERE cm.escola_id=p_escola_id
          AND cm.matricula_origem_id=m.id
          AND cm.aluno_id=m.aluno_id AND cm.status='elegivel'
          AND c.ativo AND c.modo='virada_assistida_sem_notas'
          AND c.ano_origem=m.ano_letivo
          AND c.ano_destino=m.ano_letivo+1
          AND (c.expira_em IS NULL OR c.expira_em >= (now() AT TIME ZONE 'Africa/Luanda')::date)
      ))
      AND (NOT EXISTS (
        SELECT 1 FROM public.notas n
        WHERE n.escola_id=p_escola_id AND n.matricula_id=m.id
          AND NOT public.curtume_2025_mfd_mirror_valid(
            n.escola_id,n.matricula_id,n.avaliacao_id,n.valor,n.metadata)
      ) OR public.curtume_2025_notas_conferidas_validas(p_escola_id,m.id))
      AND EXISTS (
        SELECT 1 FROM public.audit_logs a
        WHERE a.escola_id=p_escola_id
          AND a.entity_id=m.id::text
          AND a.actor_id IS NOT NULL
          AND a.action='MATRICULA_ORIGEM_RESULTADO_ACADEMICO_REGISTADO'
          AND a.details->>'fonte'='declaracao_administrativa_escola'
          AND a.details->>'ratificacao'='true'
          AND a.details->>'papel_autorizado' IN ('secretaria','admin_secretaria','admin_secretario','admin_financeiro','admin','admin_escola','staff_admin','diretor')
          AND a.details->>'historico_ano_id'=h.id::text
          AND a.details->>'resultado_final'=h.resultado_final
          AND length(btrim(coalesce(a.details->>'referencia_documental','')))>=8
          AND length(btrim(coalesce(a.details->>'motivo','')))>=12
      )
    LIMIT 1;
    IF v_historic.matricula_id IS NOT NULL THEN
      v_regime := public.resolve_regime_academico(v_historic.turma_id);
      -- Approved final-cycle learners have completed the cycle: do not
      -- reinterpret their ratified 9th-class approval as an ordinary move.
      v_terminale := v_historic.resultado = 'aprovado' AND (
        COALESCE((v_regime->>'eh_classe_exame')::boolean,false)
        OR (v_regime->>'nivel_ensino'='primario'
            AND (v_regime->>'classe_num')::integer=6
            AND NOT EXISTS (
              SELECT 1 FROM public.matriculas src
              JOIN public.anos_letivos ay ON ay.escola_id=src.escola_id
                AND ay.ano=src.ano_letivo+1 AND ay.ativo IS TRUE
              JOIN public.turmas dt ON dt.escola_id=src.escola_id
                AND dt.session_id=ay.id AND dt.ano_letivo=ay.ano
                AND dt.nivel_ensino='secundario'
                AND lower(coalesce(dt.status_fecho,'aberto'))='aberto'
              JOIN public.classes dc ON dc.id=dt.classe_id
                AND dc.escola_id=dt.escola_id AND dc.numero=7
              WHERE src.id=p_matricula_id AND src.escola_id=p_escola_id
            ))
        OR (v_regime->>'nivel_ensino'='secundario'
            AND (v_regime->>'classe_num')::integer=12)
        OR (v_regime->>'nivel_ensino'='eja'
            AND (COALESCE((v_regime->>'modulo_numero')::integer,0)=3
                 OR COALESCE((v_regime->>'ano_numero')::integer,0)=2))
      );
      RETURN jsonb_build_object(
        'decision', CASE WHEN v_terminale THEN 'concluiu' ELSE
          CASE v_historic.resultado WHEN 'aprovado' THEN 'transitou'
               WHEN 'reprovado' THEN 'retido' ELSE 'concluiu' END END,
        'destino', CASE WHEN v_terminale THEN 'conclusao' ELSE
          CASE v_historic.resultado WHEN 'aprovado' THEN 'proxima_etapa'
               WHEN 'reprovado' THEN 'mesma_etapa' ELSE 'conclusao' END END,
        'motivo','historico_documental_ratificado',
        'fonte_decisao','historico_documental_ratificado',
        'historico_ano_id',v_historic.historico_id,
        'disciplina_ids_pendentes','[]'::jsonb,
        'regime',v_regime,
        'etapa_destino',null,
        'efetivacao_matricula_bloqueada',false
      );
    END IF;
  END IF;

  SELECT id, pendencias, motivo INTO v_authorized
  FROM public.promocoes_com_pendencias
  WHERE escola_id = p_escola_id
    AND matricula_origem_id = p_matricula_id
    AND status = 'autorizada'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_authorized.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'decision', 'transitou',
      'destino', 'proxima_etapa',
      'motivo', 'promovido_com_pendencias',
      'autorizacao_id', v_authorized.id,
      'disciplina_ids_pendentes', v_authorized.pendencias,
      'proximo_passo', 'Lançar e fechar as notas pendentes da matrícula de origem.'
    );
  END IF;

  v_legal := public.resolve_raa_decreto_for_matricula(p_escola_id, p_matricula_id);
  IF v_legal IS NOT NULL THEN
    RETURN v_legal;
  END IF;

  BEGIN
    RETURN public.resolve_raa_progression_for_matricula_generic(p_escola_id, p_matricula_id);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%RAA_PROGRESSION_POLICY_NOT_CONFIGURED%' THEN
      RETURN jsonb_build_object(
        'decision', 'pendente', 'destino', 'aguardar_dados', 'motivo', 'dados_pendentes',
        'disciplina_ids_pendentes', '[]'::jsonb,
        'proximo_passo', 'Configurar a política de progressão e concluir as notas finais da matrícula.'
      );
    END IF;
    RAISE;
  END;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.preparar_aluno_para_rematricula(p_escola_id uuid, p_aluno_id uuid, p_from_session_id uuid, p_to_session_id uuid, p_turma_destino_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_id uuid := public.safe_auth_uid();
  v_source record;
  v_source_turma record;
  v_target_turma record;
  v_target record;
  v_to_year integer;
  v_source_number integer;
  v_target_number integer;
  v_expected_number integer;
  v_occupancy integer;
  v_new_id uuid;
  v_raa jsonb;
  v_decision text;
  v_retido boolean;
BEGIN
  IF public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido';
  END IF;
  IF NOT public.user_has_role_in_school(
    p_escola_id,
    ARRAY['admin','admin_escola','staff_admin','admin_financeiro','admin_secretaria','admin_secretario','diretor','secretaria_financeiro','secretaria']
  ) THEN
    RAISE EXCEPTION 'AUTH: permissão negada';
  END IF;

  SELECT * INTO v_source
  FROM public.matriculas
  WHERE escola_id = p_escola_id
    AND aluno_id = p_aluno_id
    AND session_id = p_from_session_id
    AND public.canonicalize_matricula_status_text(status) IN ('ativo', 'concluido', 'reprovado', 'transferido')
  ORDER BY created_at DESC NULLS LAST, id DESC
  LIMIT 1
  FOR UPDATE;
  IF v_source.id IS NULL THEN
    RAISE EXCEPTION 'DATA: matrícula de origem fechada não encontrada';
  END IF;

  SELECT ano INTO v_to_year
  FROM public.anos_letivos
  WHERE id = p_to_session_id
    AND escola_id = p_escola_id
    AND ativo = true;
  IF v_to_year IS NULL OR coalesce(v_source.ano_letivo, 0) >= v_to_year THEN
    RAISE EXCEPTION 'DATA: ano letivo de destino inválido';
  END IF;

  v_raa := public.resolve_raa_progression_for_matricula(p_escola_id, v_source.id);
  v_decision := lower(coalesce(v_raa->>'decision', ''));
  IF NOT (
    v_decision = 'transitou'
    OR (
      v_decision = 'inscricao_condicional'
      AND lower(coalesce(v_raa->>'destino', '')) = 'proxima_etapa'
      AND NOT coalesce((v_raa->>'efetivacao_matricula_bloqueada')::boolean, false)
    )
    OR (
      v_decision = 'retido'
      AND lower(coalesce(v_raa->>'destino', '')) = 'mesma_etapa'
    )
  ) THEN
    RAISE EXCEPTION 'RAA_PROGRESSION_BLOCKED: decisão % não autoriza reserva de rematrícula', nullif(v_decision, '');
  END IF;
  v_retido := v_decision = 'retido';

  SELECT * INTO v_source_turma
  FROM public.turmas
  WHERE id = v_source.turma_id
    AND escola_id = p_escola_id;
  IF v_source_turma.id IS NULL THEN
    RAISE EXCEPTION 'DATA: turma de origem não encontrada';
  END IF;
  v_source_number := public.turma_classe_numero(v_source_turma.id);
  v_expected_number := CASE
    WHEN NOT v_retido AND v_source_number IS NULL
      AND v_source_turma.nivel_ensino='pre_escolar'
      AND EXISTS (SELECT 1 FROM public.classes pc
        WHERE pc.id=v_source_turma.classe_id AND pc.escola_id=p_escola_id
          AND pc.nome='Pré-Escolar') THEN 1
    WHEN v_retido THEN v_source_number
    ELSE v_source_number+1
  END;
  IF v_expected_number IS NULL THEN
    RAISE EXCEPTION 'DATA: classe da turma de origem não pôde ser determinada';
  END IF;

  IF p_turma_destino_id IS NULL THEN
    SELECT t.* INTO v_target_turma
    FROM public.turmas t
    WHERE t.escola_id = p_escola_id
      AND t.session_id = p_to_session_id
      AND t.ano_letivo = v_to_year
      AND (
        t.curso_id IS NOT DISTINCT FROM v_source_turma.curso_id
        OR (v_source_number IS NULL AND v_expected_number=1
          AND v_source_turma.nivel_ensino='pre_escolar'
          AND t.nivel_ensino='primario')
      )
      AND public.turma_classe_numero(t.id) = v_expected_number
      AND t.turno IS NOT DISTINCT FROM v_source_turma.turno
      AND t.letra IS NOT DISTINCT FROM v_source_turma.letra
    ORDER BY t.id
    LIMIT 1;
  ELSE
    SELECT t.* INTO v_target_turma
    FROM public.turmas t
    WHERE t.id = p_turma_destino_id
      AND t.escola_id = p_escola_id
      AND t.session_id = p_to_session_id
      AND t.ano_letivo = v_to_year;
  END IF;
  IF v_target_turma.id IS NULL THEN
    RAISE EXCEPTION 'DATA: turma de destino não encontrada no ano letivo';
  END IF;
  IF v_target_turma.curso_id IS DISTINCT FROM v_source_turma.curso_id
     AND NOT (
       p_turma_destino_id IS NOT NULL
       AND NOT v_retido AND v_source_number = 6
       AND public.turma_classe_numero(v_target_turma.id) = 7
       AND v_source_turma.nivel_ensino = 'primario'
       AND v_target_turma.nivel_ensino = 'secundario'
     )
     AND NOT (
       NOT v_retido AND v_source_number IS NULL AND v_expected_number=1
       AND v_source_turma.nivel_ensino='pre_escolar'
       AND v_target_turma.nivel_ensino='primario'
       AND public.turma_classe_numero(v_target_turma.id)=1
       AND EXISTS (SELECT 1 FROM public.classes pc
         WHERE pc.id=v_source_turma.classe_id AND pc.escola_id=p_escola_id
           AND pc.nome='Pré-Escolar')
     ) THEN
    RAISE EXCEPTION 'DATA: turma destino pertence a outro curso';
  END IF;
  v_target_number := public.turma_classe_numero(v_target_turma.id);
  IF v_target_number IS NULL OR v_target_number IS DISTINCT FROM v_expected_number THEN
    RAISE EXCEPTION 'DATA: turma destino incompatível com a decisão RAA %', v_decision;
  END IF;

  SELECT m.* INTO v_target
  FROM public.matriculas m
  WHERE m.escola_id = p_escola_id
    AND m.aluno_id = p_aluno_id
    AND m.session_id = p_to_session_id
    AND m.ano_letivo = v_to_year
  ORDER BY CASE WHEN public.canonicalize_matricula_status_text(m.status) = 'ativo' THEN 0 ELSE 1 END,
           m.created_at DESC NULLS LAST,
           m.id DESC
  LIMIT 1
  FOR UPDATE;
  IF public.canonicalize_matricula_status_text(v_source.status) = 'transferido'
     AND v_target.id IS NULL THEN
    RAISE EXCEPTION 'CONFLICT: origem transferida sem matrícula destino existente';
  END IF;
  IF v_target.id IS NOT NULL THEN
    IF public.canonicalize_matricula_status_text(v_target.status) = 'ativo' THEN
      IF v_target.turma_id IS DISTINCT FROM v_target_turma.id THEN
        RAISE EXCEPTION 'CONFLICT: matrícula ativa já existe noutra turma do ano destino';
      END IF;
    ELSIF v_target.turma_id IS DISTINCT FROM v_target_turma.id THEN
      SELECT count(*)::integer INTO v_occupancy
      FROM public.matriculas m
      WHERE m.escola_id = p_escola_id
        AND m.turma_id = v_target_turma.id
        AND m.session_id = p_to_session_id
        AND m.id <> v_target.id
        AND public.canonicalize_matricula_status_text(m.status) IN ('ativo', 'pendente');
      IF v_target_turma.capacidade_maxima IS NOT NULL AND v_occupancy >= v_target_turma.capacidade_maxima THEN
        RAISE EXCEPTION 'DATA: turma de destino sem vagas';
      END IF;
      UPDATE public.matriculas
      SET turma_id = v_target_turma.id,
          origem_transicao_matricula_id = v_source.id,
          updated_at = now()
      WHERE id = v_target.id;
      v_target.turma_id := v_target_turma.id;
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'reused', true,
      'matricula_id', v_target.id,
      'turma_id', v_target.turma_id,
      'status', v_target.status,
      'reservada', public.canonicalize_matricula_status_text(v_target.status) <> 'ativo',
      'raa', v_raa
    );
  END IF;

  SELECT count(*)::integer INTO v_occupancy
  FROM public.matriculas m
  WHERE m.escola_id = p_escola_id
    AND m.turma_id = v_target_turma.id
    AND m.session_id = p_to_session_id
    AND public.canonicalize_matricula_status_text(m.status) IN ('ativo', 'pendente');
  IF v_target_turma.capacidade_maxima IS NOT NULL AND v_occupancy >= v_target_turma.capacidade_maxima THEN
    RAISE EXCEPTION 'DATA: turma de destino sem vagas';
  END IF;

  INSERT INTO public.matriculas (
    escola_id, aluno_id, turma_id, session_id, ano_letivo, status,
    ativo, numero_matricula, data_matricula, data_inicio_financeiro,
    created_at, updated_at, origem_transicao_matricula_id
  ) VALUES (
    p_escola_id, p_aluno_id, v_target_turma.id, p_to_session_id, v_to_year, 'pendente',
    false, NULL, CURRENT_DATE, NULL, now(), now(), v_source.id
  )
  RETURNING id INTO v_new_id;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, details, portal)
  VALUES (
    p_escola_id, v_actor_id, 'ALUNO_PROMOCAO_RESERVA_REMATRICULA', 'matriculas', v_new_id::text,
    jsonb_build_object(
      'aluno_id', p_aluno_id,
      'matricula_origem_id', v_source.id,
      'ano_letivo_destino_id', p_to_session_id,
      'turma_destino_id', v_target_turma.id,
      'raa_decision', v_decision,
      'at', now()
    ),
    'admin'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'reused', false,
    'reservada', true,
    'status', 'pendente',
    'matricula_id', v_new_id,
    'turma_id', v_target_turma.id,
    'raa', v_raa
  );
END;
$function$
;
CREATE OR REPLACE FUNCTION public.finalizar_rematricula_balcao(p_escola_id uuid, p_aluno_id uuid, p_matricula_origem_id uuid, p_ano_letivo_id uuid, p_destino_turma_id uuid, p_pedido_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_ano_destino int;
  v_turma record;
  v_origem record;
  v_destino record;
  v_ocupacao int;
  v_criada boolean := false;
  v_classe_origem record;
  v_classe_destino record;
  v_numero_origem int;
  v_numero_destino int;
  v_numero_matricula bigint;
  v_raa jsonb;
  v_decision text;
  v_decisao_origem text;
  v_retido boolean := false;
  v_actor_id uuid := public.safe_auth_uid();
  v_is_late_enrollment boolean := false;
  v_jwt_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );
BEGIN
  -- service_role continua autorizado para operações internas confiáveis. Para
  -- qualquer sessão humana, a identidade e o vínculo/papel na escola são
  -- obrigatórios. user_has_role_in_school() é auth.uid()-scoped e trata os
  -- papéis compostos (secretaria_financeiro/admin_financeiro) canonicamente.
  IF v_jwt_role IS DISTINCT FROM 'service_role' THEN
    IF v_actor_id IS NULL THEN
      RAISE EXCEPTION 'AUTH_REQUIRED: utilizador autenticado é obrigatório'
        USING ERRCODE = '42501';
    END IF;

    IF NOT public.user_has_role_in_school(
      p_escola_id,
      ARRAY[
        'secretaria',
        'secretaria_financeiro',
        'admin_financeiro',
        'admin_secretaria',
        'admin_secretario',
        'admin',
        'admin_escola',
        'staff_admin',
        'diretor'
      ]::text[]
    ) THEN
      RAISE EXCEPTION 'AUTH_FORBIDDEN: sem permissão para concluir rematrícula nesta escola'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT al.ano INTO v_ano_destino
  FROM public.anos_letivos al
  WHERE al.id = p_ano_letivo_id
    AND al.escola_id = p_escola_id
    AND al.ativo = true;
  IF v_ano_destino IS NULL THEN RAISE EXCEPTION 'Ano letivo destino inválido'; END IF;

  SELECT t.id, t.session_id, t.ano_letivo, t.capacidade_maxima, t.status_fecho
    INTO v_turma
  FROM public.turmas t
  WHERE t.id = p_destino_turma_id
    AND t.escola_id = p_escola_id
    AND t.session_id = p_ano_letivo_id
    AND t.ano_letivo = v_ano_destino;
  IF v_turma.id IS NULL THEN RAISE EXCEPTION 'Turma destino não pertence ao ano letivo seleccionado'; END IF;
  IF lower(coalesce(v_turma.status_fecho, 'aberto')) NOT IN ('aberto', 'open', '') THEN RAISE EXCEPTION 'Turma destino está fechada'; END IF;

  SELECT m.* INTO v_origem
  FROM public.matriculas m
  WHERE m.id = p_matricula_origem_id
    AND m.escola_id = p_escola_id
    AND m.aluno_id = p_aluno_id
  FOR UPDATE;
  IF v_origem.id IS NULL THEN RAISE EXCEPTION 'Matrícula de origem não encontrada'; END IF;
  IF v_origem.ano_letivo IS NULL OR v_origem.ano_letivo >= v_ano_destino THEN RAISE EXCEPTION 'Matrícula de origem não é de um ano anterior'; END IF;

  -- A closed registration calendar does not prevent an authorized Balcao
  -- operator from enrolling an academically eligible student. Keep the date
  -- classification for atomic audit; do not reopen the school-wide window.
  v_is_late_enrollment := NOT EXISTS (
    SELECT 1 FROM public.rematricula_janelas j
    WHERE j.escola_id=p_escola_id AND j.ano_letivo=v_ano_destino
      AND j.ativa=true AND now() BETWEEN j.data_inicio AND j.data_fim
  );

  SELECT m.* INTO v_destino
  FROM public.matriculas m
  WHERE m.escola_id = p_escola_id
    AND m.aluno_id = p_aluno_id
    AND m.session_id = p_ano_letivo_id
    AND m.ano_letivo = v_ano_destino
  ORDER BY CASE WHEN lower(coalesce(m.status, '')) IN ('ativo', 'ativa', 'active') THEN 0 ELSE 1 END,
           m.created_at DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  -- Verify completed original enrollment and order scope before reusing;
  -- never reauthorize a payment, invent receipt or mutate a document.
  IF v_destino.id IS NOT NULL AND v_destino.ativo IS TRUE
    AND lower(coalesce(v_destino.status,'')) IN ('ativo','ativa','active')
    AND v_destino.turma_id=p_destino_turma_id
    AND v_destino.session_id=p_ano_letivo_id
    AND (v_destino.origem_transicao_matricula_id IS NULL
         OR v_destino.origem_transicao_matricula_id=p_matricula_origem_id)
    AND EXISTS (
      SELECT 1 FROM public.servico_pedidos sp
      JOIN public.servicos_escola se ON se.id=sp.servico_escola_id
        AND se.escola_id=sp.escola_id AND se.codigo='SERV_REMATRICULA'
      WHERE sp.id=p_pedido_id AND sp.escola_id=p_escola_id
        AND sp.aluno_id=p_aluno_id AND sp.servico_codigo='SERV_REMATRICULA'
        AND sp.status='granted'
        AND sp.matricula_id IN (v_destino.id,p_matricula_origem_id)
        AND sp.contexto->>'matricula_destino_id'=v_destino.id::text
        AND sp.contexto->>'ano_letivo_id'=p_ano_letivo_id::text
        AND sp.contexto->>'destino_turma_id'=p_destino_turma_id::text
        AND sp.contexto->>'origem_matricula_id'=p_matricula_origem_id::text
    )
  THEN
    RETURN jsonb_build_object(
      'ok',true,'idempotent',true,'matricula_id',v_destino.id,
      'numero_matricula',v_destino.numero_matricula,
      'turma_id',v_destino.turma_id,'ano_letivo_id',p_ano_letivo_id
    );
  END IF;

  -- FIN-P0: validate the specific service order, immutable payment evidence and
  -- service receipt BEFORE modifying academic history or destination.
  PERFORM public._assert_rematricula_payment_proof(
    p_escola_id, p_aluno_id, p_matricula_origem_id,
    p_ano_letivo_id, p_destino_turma_id, p_pedido_id,
    v_ano_destino, v_destino.id
  );

  IF public.canonicalize_matricula_status_text(v_origem.status)
     NOT IN ('ativo', 'pendente', 'concluido', 'transferido') THEN
    RAISE EXCEPTION 'Matrícula de origem não está elegível para rematrícula';
  END IF;

  v_raa := public.resolve_raa_progression_for_matricula(p_escola_id, v_origem.id);
  v_decision := lower(coalesce(v_raa->>'decision', ''));

  IF NOT (
    v_decision = 'transitou'
    OR (
      v_decision = 'inscricao_condicional'
      AND lower(coalesce(v_raa->>'destino', '')) = 'proxima_etapa'
      AND NOT coalesce((v_raa->>'efetivacao_matricula_bloqueada')::boolean, false)
    )
    OR (
      v_decision = 'retido'
      AND lower(coalesce(v_raa->>'destino', '')) = 'mesma_etapa'
    )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'REMATRICULA_ACADEMIC_BLOCKED',
      DETAIL = format(
        'O RAA não autoriza a efetivação da rematrícula; decisão=%s destino=%s bloqueada=%s.',
        nullif(v_decision, ''),
        nullif(lower(coalesce(v_raa->>'destino', '')), ''),
        coalesce((v_raa->>'efetivacao_matricula_bloqueada')::boolean, false)
      );
  END IF;

  v_retido := v_decision = 'retido';
  v_decisao_origem := v_decision;

  SELECT c.id, c.numero, c.nome, t.curso_id, t.nivel_ensino
    INTO v_classe_origem
  FROM public.turmas t
  LEFT JOIN public.classes c ON c.id = t.classe_id
  WHERE t.id = v_origem.turma_id AND t.escola_id = p_escola_id;
  v_numero_origem := COALESCE(v_classe_origem.numero,
    NULLIF((regexp_match(COALESCE(v_classe_origem.nome, ''), '(\d{1,2})'))[1], '')::int);

  IF v_destino.id IS NULL THEN
    SELECT count(*)::int INTO v_ocupacao
    FROM public.matriculas m
    WHERE m.escola_id = p_escola_id
      AND m.turma_id = p_destino_turma_id
      AND m.session_id = p_ano_letivo_id
      AND lower(coalesce(m.status, '')) IN ('ativo', 'ativa', 'active');
    IF v_turma.capacidade_maxima IS NOT NULL AND v_ocupacao >= v_turma.capacidade_maxima THEN RAISE EXCEPTION 'Turma destino sem vagas'; END IF;

    INSERT INTO public.matriculas (
      id, escola_id, aluno_id, turma_id, session_id, ano_letivo,
      status, ativo, created_at, data_matricula, data_inicio_financeiro,
      origem_transicao_matricula_id
    ) VALUES (
      gen_random_uuid(), p_escola_id, p_aluno_id, p_destino_turma_id,
      p_ano_letivo_id, v_ano_destino, 'pendente', false, now(), CURRENT_DATE,
      CURRENT_DATE, p_matricula_origem_id
    ) RETURNING * INTO v_destino;
    v_criada := true;
  ELSE
    UPDATE public.matriculas
       SET turma_id = p_destino_turma_id,
           session_id = p_ano_letivo_id,
           ano_letivo = v_ano_destino,
           data_inicio_financeiro = coalesce(data_inicio_financeiro, CURRENT_DATE),
           origem_transicao_matricula_id = coalesce(origem_transicao_matricula_id, p_matricula_origem_id)
     WHERE id = v_destino.id;
    SELECT * INTO v_destino FROM public.matriculas WHERE id = v_destino.id;
  END IF;

  SELECT c.id, c.numero, c.nome, t.curso_id, t.nivel_ensino
    INTO v_classe_destino
  FROM public.turmas t
  LEFT JOIN public.classes c ON c.id = t.classe_id
  WHERE t.id = p_destino_turma_id AND t.escola_id = p_escola_id;
  v_numero_destino := COALESCE(v_classe_destino.numero,
    NULLIF((regexp_match(COALESCE(v_classe_destino.nome, ''), '(\d{1,2})'))[1], '')::int);

  IF v_numero_origem IS NULL
     AND v_classe_origem.nivel_ensino='pre_escolar'
     AND v_classe_origem.nome='Pré-Escolar'
     AND (v_retido OR v_numero_destino IS DISTINCT FROM 1
          OR v_classe_destino.nivel_ensino IS DISTINCT FROM 'primario')
  THEN
    RAISE EXCEPTION 'Turma destino inválida: Pré-Escolar deve seguir para 1ª classe do Ensino Primário';
  END IF;
  IF v_numero_origem IS NOT NULL AND v_numero_destino IS NOT NULL THEN
    IF v_retido THEN
      IF v_numero_destino <> v_numero_origem THEN
        RAISE EXCEPTION 'Turma destino inválida: aluno retido deve repetir a mesma classe';
      END IF;
    ELSE
      IF v_numero_origem = 12 THEN RAISE EXCEPTION 'Aluno da 12ª classe não tem classe seguinte para rematrícula'; END IF;
      IF v_numero_destino <> v_numero_origem + 1 THEN
        RAISE EXCEPTION 'Turma destino inválida: aluno aprovado deve seguir para a classe imediatamente seguinte';
      END IF;
    END IF;
  END IF;
  IF v_classe_origem.curso_id IS NOT NULL AND v_classe_destino.curso_id IS NOT NULL
     AND v_classe_origem.curso_id <> v_classe_destino.curso_id
     AND NOT (
       NOT v_retido AND v_numero_origem = 6 AND v_numero_destino = 7
       AND v_classe_origem.nivel_ensino = 'primario'
       AND v_classe_destino.nivel_ensino = 'secundario'
     )
     AND NOT (
       NOT v_retido AND v_numero_origem IS NULL AND v_numero_destino=1
       AND v_classe_origem.nivel_ensino='pre_escolar'
       AND v_classe_origem.nome='Pré-Escolar'
       AND v_classe_destino.nivel_ensino='primario'
     )
  THEN
    RAISE EXCEPTION 'Turma destino pertence a outro curso';
  END IF;

  -- O resultado deve existir no historico antes de encerrar a fonte.
  IF v_decision IN ('transitou','retido')
     AND public.canonicalize_matricula_status_text(v_origem.status) IN ('ativo','pendente') THEN
    IF v_jwt_role='service_role' THEN
      RAISE EXCEPTION 'ACADEMIC_AUTHOR_REQUIRED: fecho historico exige operador da escola' USING ERRCODE='42501';
    END IF;
    PERFORM public.finalizar_origem_academica(
      p_escola_id,v_origem.id,
      CASE WHEN v_retido THEN 'reprovado' ELSE 'aprovado' END,
      'raa','Decisao RAA verificada na rematricula do Balcao',NULL
    );
  END IF;

  IF lower(coalesce(v_destino.status, '')) NOT IN ('ativo', 'ativa', 'active')
     OR v_destino.numero_matricula IS NULL OR btrim(v_destino.numero_matricula::text) = '' THEN
    v_numero_matricula := public.confirmar_matricula_core(p_aluno_id, v_ano_destino, p_destino_turma_id, v_destino.id);
  END IF;

  UPDATE public.matriculas
     SET status = 'ativo', ativo = true, turma_id = p_destino_turma_id,
         session_id = p_ano_letivo_id, ano_letivo = v_ano_destino, updated_at = now()
   WHERE id = v_destino.id;
  SELECT * INTO v_destino FROM public.matriculas WHERE id = v_destino.id;

  UPDATE public.matriculas
     SET status = 'concluido',
         ativo = false,
         motivo_fecho = coalesce(
           motivo_fecho,
           CASE
             WHEN v_retido THEN 'Resultado académico retido; repetição confirmada no ano letivo destino'
             ELSE 'Resultado académico concluído; rematrícula confirmada no ano letivo destino'
           END
         ),
         data_fecho = coalesce(data_fecho, now()), updated_at = now()
   WHERE id = p_matricula_origem_id AND id <> v_destino.id
    AND v_decision IN ('transitou','retido')
    -- The verified and legally locked documentary origin is immutable.
    -- The canonical RAA bridge already validated tenant, result and signature.
    AND COALESCE(v_raa->>'fonte_decisao','') <> 'historico_documental_ratificado';

  -- Renewal and the late-operation audit share one transaction. Do not
  -- consume old approval tokens: they are no longer required for this path.
  IF v_is_late_enrollment THEN
    INSERT INTO public.audit_logs(escola_id,actor_id,action,entity,entity_id,portal,details)
    VALUES(p_escola_id,v_actor_id,'BALCAO_REMATRICULA_FORA_PRAZO_CONCLUIDA',
      'matriculas',v_origem.id::text,'secretaria',
      jsonb_build_object('modo','direta','matricula_destino_id',v_destino.id,
        'ano_destino_id',p_ano_letivo_id,'pedido_id',p_pedido_id,
        'turma_destino_id',p_destino_turma_id,
        'resultado_raa',v_decisao_origem,
        'matricula_criada',v_criada));
  END IF;

  UPDATE public.servico_pedidos
     SET status = 'granted', matricula_id = v_destino.id,
         contexto = coalesce(contexto, '{}'::jsonb) || jsonb_build_object(
           'matricula_destino_id', v_destino.id,
           'ano_letivo_id', p_ano_letivo_id,
           'destino_turma_id', p_destino_turma_id,
           'matricula_criada', v_criada,
           'decisao_academica', v_decisao_origem
         )
   WHERE id = p_pedido_id AND escola_id = p_escola_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido de rematrícula não encontrado'; END IF;

  RETURN jsonb_build_object(
    'ok', true, 'matricula_id', v_destino.id,
    'numero_matricula', v_destino.numero_matricula,
    'turma_id', p_destino_turma_id, 'ano_letivo_id', p_ano_letivo_id,
    'matricula_criada', v_criada, 'raa', v_raa,
    'decisao_academica', v_decisao_origem
  );
END;
$function$
;
COMMIT;