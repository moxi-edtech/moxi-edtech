-- PR #195 / gate de aplicação em ambiente de teste primeiro.
-- Não tocar em RLS, ledger, outbox, recibos nem permissões existentes.
CREATE OR REPLACE FUNCTION public.aluno_solicitar_boletim_matricula(
  p_escola_id uuid, p_aluno_id uuid, p_matricula_id uuid, p_session_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_email text := lower(trim(COALESCE(auth.jwt()->>'email', '')));
  v_serv public.servicos_escola%ROWTYPE;
  v_pedido public.servico_pedidos%ROWTYPE;
  v_intent_id uuid;
  v_year_active boolean;
BEGIN
  IF v_actor IS NULL OR public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola ou utilizador inválido';
  END IF;
  -- Mesmo universo de acesso da RPC existente: aluno ou encarregado autorizado.
  IF NOT EXISTS (
    SELECT 1 FROM public.alunos a WHERE a.id=p_aluno_id AND a.escola_id=p_escola_id
      AND (a.usuario_auth_id=v_actor OR a.profile_id=v_actor)
  ) AND NOT EXISTS (
    SELECT 1 FROM public.aluno_encarregados ae
      JOIN public.encarregados e ON e.id=ae.encarregado_id AND e.escola_id=p_escola_id
    WHERE ae.escola_id=p_escola_id AND ae.aluno_id=p_aluno_id
      AND lower(trim(e.email))=v_email
  ) THEN RAISE EXCEPTION 'AUTH: aluno não autorizado'; END IF;

  SELECT ativo INTO v_year_active FROM public.anos_letivos
  WHERE id=p_session_id AND escola_id=p_escola_id;
  IF v_year_active IS DISTINCT FROM true THEN RAISE EXCEPTION 'ACADEMIC_YEAR_CLOSED'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.matriculas m
    WHERE m.id=p_matricula_id AND m.escola_id=p_escola_id AND m.aluno_id=p_aluno_id
      AND m.session_id=p_session_id AND m.status IN ('ativo','ativa')
  ) THEN RAISE EXCEPTION 'CROSS_YEAR_ENTITY_MISMATCH'; END IF;

  SELECT * INTO v_serv FROM public.servicos_escola
  WHERE escola_id=p_escola_id AND codigo='DOC_BOLETIM_TRIMESTRAL' AND ativo=true;
  IF v_serv.id IS NULL OR COALESCE(v_serv.valor_base,0) <= 0 THEN
    RAISE EXCEPTION 'FEE_NOT_CONFIGURED'; END IF;

  -- Tranca por estudante/matrícula/serviço: clique duplo cria um único pedido/cobrança.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_escola_id::text || ':' || p_aluno_id::text || ':' ||
    p_matricula_id::text || ':DOC_BOLETIM_TRIMESTRAL', 0));

  SELECT * INTO v_pedido FROM public.servico_pedidos
  WHERE escola_id=p_escola_id AND aluno_id=p_aluno_id
    AND matricula_id=p_matricula_id AND servico_codigo='DOC_BOLETIM_TRIMESTRAL'
    AND status IN ('pending_payment','blocked','canceled','granted')
  ORDER BY created_at DESC, id DESC LIMIT 1;

  IF v_pedido.id IS NOT NULL THEN
    SELECT id INTO v_intent_id FROM public.pagamento_intents
    WHERE escola_id=p_escola_id AND aluno_id=p_aluno_id
      AND servico_pedido_id=v_pedido.id ORDER BY created_at DESC LIMIT 1;
    IF v_pedido.status='canceled' AND v_intent_id IS NULL THEN
      RAISE EXCEPTION 'STATE: pedido cancelado sem cobrança; contacte a secretaria'; END IF;
    RETURN jsonb_build_object('ok',true,'pedido_id',v_pedido.id,
      'pagamento_id',v_intent_id,'status',v_pedido.status,
      'valor',v_pedido.valor_cobrado,'matricula_id',p_matricula_id,
      'session_id',p_session_id,'idempotent',true);
  END IF;

  INSERT INTO public.servico_pedidos
    (escola_id,aluno_id,matricula_id,servico_escola_id,status,servico_codigo,servico_nome,valor_cobrado,created_by)
  VALUES (p_escola_id,p_aluno_id,p_matricula_id,v_serv.id,'pending_payment',
          v_serv.codigo,v_serv.nome,v_serv.valor_base,v_actor)
  RETURNING * INTO v_pedido;
  INSERT INTO public.pagamento_intents
    (escola_id,aluno_id,servico_pedido_id,amount,status,method,created_by)
  VALUES (p_escola_id,p_aluno_id,v_pedido.id,v_serv.valor_base,'draft','transfer',v_actor)
  RETURNING id INTO v_intent_id;
  INSERT INTO public.audit_logs(escola_id,actor_id,action,entity,entity_id,portal,details)
  VALUES (p_escola_id,v_actor,'BOLETIM_PEDIDO_CRIADO','servico_pedidos',
    v_pedido.id::text,'aluno',
    jsonb_build_object('matricula_id',p_matricula_id,'session_id',p_session_id,
      'previous_status',NULL,'status','pending_payment','at',now()));
  RETURN jsonb_build_object('ok',true,'pedido_id',v_pedido.id,
    'pagamento_id',v_intent_id,'status','pending_payment',
    'valor',v_serv.valor_base,'matricula_id',p_matricula_id,
    'session_id',p_session_id,'idempotent',false);
END;
$$;
ALTER FUNCTION public.aluno_solicitar_boletim_matricula(uuid,uuid,uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.aluno_solicitar_boletim_matricula(uuid,uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aluno_solicitar_boletim_matricula(uuid,uuid,uuid,uuid) TO authenticated;
