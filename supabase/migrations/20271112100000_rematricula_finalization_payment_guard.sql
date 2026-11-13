-- FIN-P0: secure the canonical reenrollment finalizer against direct RPC calls.
-- The full function body is deliberately derived from the newest canonical
-- migration, 20271112020000_balcao_primary_secondary_6_to_7.sql.
-- No customer data is modified by this migration.
BEGIN;

-- Only the canonical SECURITY DEFINER writer may use this internal evidence gate.
CREATE OR REPLACE FUNCTION public._assert_rematricula_payment_proof(
  p_escola_id uuid, p_aluno_id uuid, p_matricula_origem_id uuid,
  p_ano_letivo_id uuid, p_destino_turma_id uuid, p_pedido_id uuid,
  p_ano_destino integer, p_destino_matricula_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $guard$
DECLARE
  v_pedido record;
  v_servico record;
  v_curso_id uuid;
  v_classe_id uuid;
  v_tabela record;
  v_preco numeric;
  v_taxa numeric;
  v_pago numeric;
  v_tem_recibo boolean;
  v_isencao_classe boolean := false;
BEGIN
  -- Serialize two finalizers for one order; a forged or unrelated order is never
  -- allowed to make the enrollment active even if it has some settled payment.
  SELECT sp.* INTO v_pedido
  FROM public.servico_pedidos sp
  WHERE sp.id = p_pedido_id AND sp.escola_id = p_escola_id
    AND sp.aluno_id = p_aluno_id
    AND sp.servico_codigo = 'SERV_REMATRICULA'
    AND sp.status IN ('pending_payment', 'granted')
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REMATRICULA_ORDER_INVALID'
      USING ERRCODE = '23514';
  END IF;

  SELECT se.id, se.valor_base, se.ativo INTO v_servico
  FROM public.servicos_escola se
  WHERE se.id = v_pedido.servico_escola_id
    AND se.escola_id = p_escola_id
    AND se.codigo = 'SERV_REMATRICULA';
  IF v_servico.id IS NULL OR v_servico.ativo IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'REMATRICULA_SERVICE_INVALID' USING ERRCODE = '23514';
  END IF;

  -- The source may be stored in the order's primary FK before finalization,
  -- or in its immutable context after the order was linked to the destination.
  IF v_pedido.contexto->>'origem_matricula_id' IS DISTINCT FROM p_matricula_origem_id::text
    OR (
      v_pedido.matricula_id IS DISTINCT FROM p_matricula_origem_id
      AND NOT (
        p_destino_matricula_id IS NOT NULL
        AND v_pedido.matricula_id = p_destino_matricula_id
        AND v_pedido.contexto->>'matricula_destino_id' = p_destino_matricula_id::text
      )
    )
    OR v_pedido.contexto->>'ano_letivo_id' IS DISTINCT FROM p_ano_letivo_id::text
    OR v_pedido.contexto->>'destino_turma_id' IS DISTINCT FROM p_destino_turma_id::text
    OR (
      v_pedido.contexto ? 'matricula_destino_preparada_id'
      AND nullif(v_pedido.contexto->>'matricula_destino_preparada_id','') IS NOT NULL
      AND v_pedido.contexto->>'matricula_destino_preparada_id'
          IS DISTINCT FROM coalesce(p_destino_matricula_id::text,'')
    )
    OR (
      v_pedido.contexto ? 'matricula_destino_id'
      AND nullif(v_pedido.contexto->>'matricula_destino_id','') IS NOT NULL
      AND v_pedido.contexto->>'matricula_destino_id'
          IS DISTINCT FROM coalesce(p_destino_matricula_id::text,'')
    )
  THEN
    RAISE EXCEPTION 'REMATRICULA_ORDER_SCOPE_MISMATCH' USING ERRCODE = '23514';
  END IF;

  -- A paid order cannot be reused to activate another, already active pupil
  -- enrollment. Reconfirmation of active students has its own audited path.
  IF p_destino_matricula_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.matriculas m
    WHERE m.id = p_destino_matricula_id AND m.escola_id = p_escola_id
      AND m.aluno_id = p_aluno_id AND m.ativo = true
      AND lower(coalesce(m.status,'')) IN ('ativo','ativa','active')
  ) AND NOT (
    v_pedido.status = 'granted'
    AND v_pedido.contexto->>'matricula_destino_id' = p_destino_matricula_id::text
  ) THEN
    RAISE EXCEPTION 'REMATRICULA_DESTINATION_ALREADY_ACTIVE' USING ERRCODE = '23514';
  END IF;

  SELECT t.curso_id,t.classe_id INTO v_curso_id,v_classe_id
  FROM public.turmas t
  WHERE t.id=p_destino_turma_id AND t.escola_id=p_escola_id
    AND t.ano_letivo=p_ano_destino AND t.session_id=p_ano_letivo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REMATRICULA_DESTINATION_INVALID' USING ERRCODE = '23514';
  END IF;

  -- Match resolveTabelaPreco(): specific course/class > class > course > school;
  -- for each scope prefer the selected year, else latest configured year.
  SELECT ft.valor_confirmacao,
     (ft.classe_id = v_classe_id AND
       (ft.curso_id = v_curso_id OR ft.curso_id IS NULL)) AS class_scope
  INTO v_tabela
  FROM public.financeiro_tabelas ft
  WHERE ft.escola_id = p_escola_id
    AND (ft.curso_id IS NULL OR ft.curso_id=v_curso_id)
    AND (ft.classe_id IS NULL OR ft.classe_id=v_classe_id)
  ORDER BY
    CASE
      WHEN ft.curso_id=v_curso_id AND ft.classe_id=v_classe_id THEN 0
      WHEN ft.curso_id IS NULL AND ft.classe_id=v_classe_id THEN 1
      WHEN ft.curso_id=v_curso_id AND ft.classe_id IS NULL THEN 2
      ELSE 3
    END,
    CASE WHEN ft.ano_letivo=p_ano_destino THEN 0 ELSE 1 END,
    ft.ano_letivo DESC,
    ft.updated_at DESC NULLS LAST,
    ft.created_at DESC NULLS LAST
  LIMIT 1;

  v_preco := CASE WHEN FOUND THEN v_tabela.valor_confirmacao ELSE NULL END;
  v_taxa := coalesce(v_preco,v_servico.valor_base,0);
  v_isencao_classe := coalesce(v_tabela.class_scope,false) AND v_preco=0;

  -- No amount may be reduced below the fee actually configured for this class.
  IF v_taxa < 0 OR v_pedido.valor_cobrado IS NULL
     OR v_pedido.valor_cobrado < 0
     OR v_pedido.valor_cobrado < v_taxa THEN
    RAISE EXCEPTION 'REMATRICULA_ORDER_AMOUNT_INVALID' USING ERRCODE = '23514';
  END IF;

  IF v_pedido.valor_cobrado=0 THEN
    IF NOT (v_isencao_classe AND v_pedido.status='granted') THEN
      RAISE EXCEPTION 'REMATRICULA_EXEMPTION_NOT_CONFIGURED' USING ERRCODE = '23514';
    END IF;
    RETURN;
  END IF;

  -- Each settled payment is counted ONCE. Intents can mirror ledger entries;
  -- never sum intentions and actual payments together.
  SELECT coalesce(sum(p.valor_pago),0) INTO v_pago
  FROM public.pagamentos p
  WHERE p.escola_id=p_escola_id AND p.aluno_id=p_aluno_id
    AND p.status='settled' AND p.settled_at IS NOT NULL
    AND p.settled_by IS NOT NULL AND p.valor_pago>0
    AND (p.meta->>'pedido_id'=p_pedido_id::text
      OR p.meta->>'servico_pedido_id'=p_pedido_id::text);

  IF v_pago < v_pedido.valor_cobrado THEN
    RAISE EXCEPTION 'REMATRICULA_PAYMENT_NOT_SETTLED' USING ERRCODE = '23514';
  END IF;

  -- Require a non-revoked SERVICE receipt, linked to an actually settled
  -- payment from this same order. Monthly receipts are not proof of the fee.
  SELECT EXISTS(
    SELECT 1 FROM public.documentos_emitidos d
    JOIN public.pagamentos p ON p.id::text=d.dados_snapshot->>'pagamento_id'
    WHERE d.escola_id=p_escola_id AND d.aluno_id=p_aluno_id
      AND d.tipo='recibo' AND d.mensalidade_id IS NULL AND d.revoked_at IS NULL
      AND p.escola_id=p_escola_id AND p.aluno_id=p_aluno_id
      AND p.mensalidade_id IS NULL AND p.status='settled'
      AND p.settled_at IS NOT NULL AND p.settled_by IS NOT NULL
      AND (p.meta->>'pedido_id'=p_pedido_id::text
        OR p.meta->>'servico_pedido_id'=p_pedido_id::text)
  ) INTO v_tem_recibo;

  IF NOT v_tem_recibo THEN
    RAISE EXCEPTION 'REMATRICULA_SERVICE_RECEIPT_REQUIRED' USING ERRCODE = '23514';
  END IF;
END;
$guard$;

REVOKE ALL ON FUNCTION public._assert_rematricula_payment_proof(
  uuid,uuid,uuid,uuid,uuid,uuid,integer,uuid
) FROM PUBLIC, anon, authenticated;

-- Authenticated staff must not fabricate payment settlement or an official
-- receipt with direct PostgREST INSERT/UPDATE. Legitimate finance/document
-- SECURITY DEFINER RPCs keep working as their trusted owning role.
CREATE OR REPLACE FUNCTION public._guard_direct_financial_evidence_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $evidence$
BEGIN
  IF current_user NOT IN ('authenticated','anon') THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME='pagamentos' THEN
    IF TG_OP='INSERT' AND (NEW.status='settled' OR NEW.settled_at IS NOT NULL) THEN
      RAISE EXCEPTION 'DIRECT_SETTLEMENT_FORBIDDEN' USING ERRCODE='42501';
    ELSIF TG_OP='UPDATE' AND (
      OLD.status='settled' OR OLD.settled_at IS NOT NULL
      OR NEW.status='settled' OR NEW.settled_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'DIRECT_SETTLEMENT_FORBIDDEN' USING ERRCODE='42501';
    END IF;
  ELSIF TG_TABLE_NAME='documentos_emitidos' THEN
    IF (TG_OP='INSERT' AND NEW.tipo::text='recibo')
       OR (TG_OP='UPDATE' AND (NEW.tipo::text='recibo' OR OLD.tipo::text='recibo')) THEN
      RAISE EXCEPTION 'DIRECT_RECEIPT_MUTATION_FORBIDDEN' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$evidence$;

DROP TRIGGER IF EXISTS trg_guard_rematricula_financial_evidence ON public.pagamentos;
CREATE TRIGGER trg_guard_rematricula_financial_evidence
BEFORE INSERT OR UPDATE ON public.pagamentos
FOR EACH ROW EXECUTE FUNCTION public._guard_direct_financial_evidence_mutation();

DROP TRIGGER IF EXISTS trg_guard_rematricula_receipt_evidence ON public.documentos_emitidos;
CREATE TRIGGER trg_guard_rematricula_receipt_evidence
BEFORE INSERT OR UPDATE ON public.documentos_emitidos
FOR EACH ROW EXECUTE FUNCTION public._guard_direct_financial_evidence_mutation();

REVOKE ALL ON FUNCTION public._guard_direct_financial_evidence_mutation()
FROM PUBLIC, anon, authenticated;

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
        'staff_admin'
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
$function$;

REVOKE ALL ON FUNCTION public.finalizar_rematricula_balcao(uuid,uuid,uuid,uuid,uuid,uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalizar_rematricula_balcao(uuid,uuid,uuid,uuid,uuid,uuid)
TO authenticated, service_role;
COMMIT;
