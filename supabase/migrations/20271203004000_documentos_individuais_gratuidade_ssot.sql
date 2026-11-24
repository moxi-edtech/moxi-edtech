BEGIN;

-- A decisão de acesso é única; a autorização do chamador pertence aos adaptadores.
CREATE OR REPLACE FUNCTION public._documento_individual_politica(
  p_escola_id uuid, p_aluno_id uuid, p_session_id uuid, p_tipo text, p_matricula_id uuid, p_portal boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_codigo text;
  v_serv public.servicos_escola%ROWTYPE;
  v_matricula uuid;
  v_matricula_status text;
  v_pedido public.servico_pedidos%ROWTYPE;
  v_intent public.pagamento_intents%ROWTYPE;
  v_pago boolean := false;
  -- Derivado da sessão autenticada, nunca de um parâmetro HTTP ou snapshot.
  v_administrativo boolean := NOT p_portal AND coalesce(public.safe_auth_uid() IS NOT NULL
    AND public.current_tenant_escola_id() = p_escola_id
    AND public.user_has_role_in_school(p_escola_id, ARRAY[
      'secretaria','secretaria_financeiro','admin_financeiro','admin_secretaria',
      'admin','admin_escola','staff_admin','diretor'
    ]::text[]), false);
  v_exige_pagamento boolean;
  v_ano integer;
  v_historico uuid;
  v_status_historico text;
  v_total_notas integer;
  v_invalidas integer;
BEGIN
  v_codigo := CASE p_tipo
    WHEN 'declaracao_frequencia' THEN 'DOC_DECLARACAO_FREQUENCIA'
    WHEN 'declaracao_notas' THEN 'DOC_DECLARACAO_NOTAS'
    WHEN 'boletim_trimestral' THEN 'DOC_BOLETIM_TRIMESTRAL'
    WHEN 'cartao_estudante' THEN 'DOC_CARTAO_ESTUDANTE'
    WHEN 'ficha_inscricao' THEN 'DOC_FICHA_INSCRICAO'
    WHEN 'comprovante_matricula' THEN 'DOC_COMPROVANTE_MATRICULA'
    WHEN 'historico' THEN 'DOC_HISTORICO_ESCOLAR'
    WHEN 'certificado' THEN 'DOC_CERTIFICADO_HABILITACOES'
    ELSE NULL
  END;
  IF v_codigo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'status', 'blocked', 'reason', 'DOCUMENT_TYPE_INVALID');
  END IF;

  SELECT ano INTO v_ano FROM public.anos_letivos
  WHERE id = p_session_id AND escola_id = p_escola_id;
  IF v_ano IS NULL THEN
    RETURN jsonb_build_object('ok',false,'status','blocked','reason','ANO_LETIVO_INVALIDO');
  END IF;

  SELECT id, status INTO v_matricula, v_matricula_status
  FROM public.matriculas
  WHERE escola_id = p_escola_id AND aluno_id = p_aluno_id
    AND session_id = p_session_id
    AND (p_matricula_id IS NULL OR id = p_matricula_id)
    AND status IN ('ativa','ativo','matriculado','concluido','reprovado','transferido','trancado')
  ORDER BY created_at DESC, id DESC LIMIT 1;
  IF v_matricula IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'status', 'blocked', 'reason', 'MATRICULA_NAO_ENCONTRADA');
  END IF;

  IF p_portal AND p_tipo IN ('declaracao_frequencia','cartao_estudante','ficha_inscricao','comprovante_matricula')
     AND v_matricula_status NOT IN ('ativa','ativo') THEN
    RETURN jsonb_build_object('ok',false,'granted',false,'status','blocked','reason','MATRICULA_INATIVA');
  END IF;

  SELECT * INTO v_serv
  FROM public.servicos_escola
  WHERE escola_id = p_escola_id AND codigo = v_codigo AND ativo IS TRUE
  LIMIT 1;
  IF v_serv.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'status', 'blocked', 'reason', 'SERVICO_NAO_CONFIGURADO');
  END IF;

  -- A validação precede a criação de pedidos ou cobranças. Ao contrário do
  -- simples fecho, exige notas por disciplina com valores válidos (zero conta).
  -- Nunca usar pautas de outra escola, matrícula ou ano.
  IF p_tipo IN ('certificado','declaracao_notas','historico') THEN
    SELECT id, snapshot_status INTO v_historico, v_status_historico
    FROM public.historico_anos
    WHERE escola_id = p_escola_id AND aluno_id = p_aluno_id AND ano_letivo = v_ano
      AND matricula_id = v_matricula
    LIMIT 1;
    IF v_historico IS NULL THEN
      RETURN jsonb_build_object('ok',false,'granted',false,'status','blocked','reason','HISTORICO_INEXISTENTE');
    END IF;
    IF v_status_historico IS DISTINCT FROM 'fechado' THEN
      RETURN jsonb_build_object('ok',false,'granted',false,'status','blocked','reason','HISTORICO_ABERTO');
    END IF;
    IF p_tipo IN ('certificado','declaracao_notas') THEN
    SELECT count(*), count(*) FILTER (WHERE
      (nota_final IS NULL AND media_final IS NULL)
      OR coalesce(nota_final,media_final) NOT BETWEEN 0 AND 20
      OR nullif(btrim(disciplina_nome),'') IS NULL
    ) INTO v_total_notas, v_invalidas
    FROM public.historico_disciplinas WHERE historico_ano_id = v_historico;
    IF v_total_notas = 0 THEN
      RETURN jsonb_build_object('ok',false,'granted',false,'status','blocked','reason','NOTAS_INEXISTENTES');
    END IF;
    IF v_invalidas > 0 THEN
      RETURN jsonb_build_object('ok',false,'granted',false,'status','blocked','reason','NOTAS_INCOMPLETAS');
    END IF;
    END IF;
  END IF;

  v_exige_pagamento := coalesce(v_serv.valor_base,0) > 0
    OR coalesce(v_serv.exige_pagamento_antes_de_liberar, false)
    OR p_tipo = 'boletim_trimestral';

  IF v_exige_pagamento AND coalesce(v_serv.valor_base,0) <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'status', 'blocked', 'reason', 'TAXA_NAO_CONFIGURADA');
  END IF;

  -- Só um pagamento do serviço EXATO e da matrícula do ano escolhido é elegível.
  SELECT * INTO v_pedido
  FROM public.servico_pedidos
  WHERE escola_id = p_escola_id AND aluno_id = p_aluno_id
    AND matricula_id = v_matricula AND servico_codigo = v_codigo
    AND status IN ('granted','pending_payment','blocked')
  ORDER BY CASE WHEN contexto->>'origem' = 'documentos_emissao_individual' THEN 0 ELSE 1 END,
           created_at DESC, id DESC
  LIMIT 1;

  IF v_pedido.id IS NOT NULL THEN
    SELECT * INTO v_intent
    FROM public.pagamento_intents
    WHERE escola_id = p_escola_id
      AND aluno_id = p_aluno_id
      AND servico_pedido_id = v_pedido.id
    ORDER BY created_at DESC, id DESC LIMIT 1;

    IF v_intent.id IS NOT NULL AND v_pedido.status = 'granted'
       AND v_intent.amount >= v_pedido.valor_cobrado
       AND v_pedido.valor_cobrado >= v_serv.valor_base
       AND (
         -- Novo fluxo: exige liquidação real ligada à intenção exata.
         (v_pedido.contexto->>'origem' = 'documentos_emissao_individual'
           AND EXISTS (
             SELECT 1 FROM public.pagamentos pg
             WHERE pg.escola_id = p_escola_id AND pg.aluno_id = p_aluno_id
               AND pg.status = 'settled' AND pg.valor_pago >= v_pedido.valor_cobrado
               AND pg.meta->>'pagamento_intent_id' = v_intent.id::text
               AND pg.meta->>'pedido_id' = v_pedido.id::text
           ))
         OR
         -- Pedidos existentes continuam válidos quando a própria intenção foi
         -- efetivamente liquidada pelo sistema legado.
         (v_pedido.contexto->>'origem' IS DISTINCT FROM 'documentos_emissao_individual'
           AND v_intent.status = 'settled')
       ) THEN
      v_pago := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'status', CASE
      WHEN v_exige_pagamento AND v_pago THEN 'paid'
      WHEN v_exige_pagamento AND v_intent.id IS NOT NULL AND v_intent.status = 'pending' THEN 'verification'
      WHEN v_exige_pagamento THEN 'pending_payment'
      WHEN NOT v_administrativo AND v_serv.exige_aprovacao AND v_pedido.status IS DISTINCT FROM 'granted' THEN 'approval'
      ELSE 'free'
    END,
    'granted', CASE
      WHEN v_exige_pagamento THEN v_pago
      WHEN NOT v_administrativo AND v_serv.exige_aprovacao THEN coalesce(v_pedido.status = 'granted', false)
      ELSE true
    END,
    'valor', v_serv.valor_base,
    'servico_codigo', v_codigo,
    'matricula_id', v_matricula,
    'pedido_id', v_pedido.id,
    'pagamento_intent_id', v_intent.id,
    'pagamento_obrigatorio', v_exige_pagamento
  );
END;
$$;


REVOKE ALL ON FUNCTION public._documento_individual_politica(uuid,uuid,uuid,text,uuid,boolean) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.documento_individual_acesso(
  p_escola_id uuid, p_aluno_id uuid, p_session_id uuid, p_tipo text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_actor uuid := public.safe_auth_uid();
BEGIN
  IF v_actor IS NULL
     OR public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id
     OR NOT public.user_has_role_in_school(p_escola_id, ARRAY[
       'secretaria','secretaria_financeiro','admin_financeiro','admin_secretaria',
       'admin','admin_escola','staff_admin','diretor'
     ]::text[]) THEN
    RAISE EXCEPTION 'AUTH_FORBIDDEN: acesso à emissão individual negado'
      USING ERRCODE = '42501';
  END IF;

  RETURN public._documento_individual_politica(p_escola_id,p_aluno_id,p_session_id,p_tipo,NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.documento_individual_acesso(uuid,uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.documento_individual_acesso(uuid,uuid,uuid,text) TO authenticated, service_role;

-- Defesa em profundidade: inclusive RPCs legadas e workers devem respeitar
-- a decisão canónica no ponto de persistência. Não afeta reimpressões.
CREATE OR REPLACE FUNCTION public._guard_documento_emissao_ssot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_session uuid;
  v_ano integer;
  v_matricula uuid;
  v_acesso jsonb;
BEGIN
  IF NEW.tipo::text NOT IN ('certificado','historico','declaracao_notas','declaracao_frequencia') THEN
    RETURN NEW;
  END IF;
  v_matricula := (NEW.dados_snapshot->>'matricula_id')::uuid;
  SELECT m.session_id, y.ano INTO v_session, v_ano
  FROM public.matriculas m JOIN public.anos_letivos y ON y.id=m.session_id AND y.escola_id=m.escola_id
  WHERE m.id=v_matricula AND m.escola_id=NEW.escola_id AND m.aluno_id=NEW.aluno_id;
  IF v_session IS NULL OR NEW.dados_snapshot->>'ano_letivo' IS DISTINCT FROM v_ano::text THEN
    RAISE EXCEPTION 'DOCUMENT_ENROLLMENT_INVALID' USING ERRCODE='42501';
  END IF;
  v_acesso := public._documento_individual_politica(NEW.escola_id,NEW.aluno_id,v_session,NEW.tipo::text,v_matricula);
  IF coalesce((v_acesso->>'granted')::boolean,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'DOCUMENT_ACCESS_DENIED: %',coalesce(v_acesso->>'reason',v_acesso->>'status','blocked') USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public._guard_documento_emissao_ssot() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS guard_documento_emissao_ssot ON public.documentos_emitidos;
CREATE TRIGGER guard_documento_emissao_ssot BEFORE INSERT ON public.documentos_emitidos
FOR EACH ROW EXECUTE FUNCTION public._guard_documento_emissao_ssot();

DROP POLICY IF EXISTS documentos_emissao_staff_insert ON public.documentos_emitidos;
CREATE POLICY documentos_emissao_staff_insert ON public.documentos_emitidos AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (tipo::text NOT IN ('certificado','historico','declaracao_notas','declaracao_frequencia')
 OR (escola_id=public.current_tenant_escola_id() AND public.user_has_role_in_school(escola_id, ARRAY[
 'secretaria','secretaria_financeiro','admin_financeiro','admin_secretaria','admin','admin_escola','staff_admin','diretor'
 ]::text[])));

-- Corrige a coerção text -> enum da RPC de produção sem substituir os
-- restantes mecanismos legais/idempotentes da função.
DO $patch$
DECLARE v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.emitir_documento_final(uuid,uuid,integer,text)'::regprocedure) INTO v_definition;
  IF position('v_numero_sequencial, p_tipo_documento, v_snapshot' in v_definition)>0 THEN
    v_definition := replace(v_definition,'v_numero_sequencial, p_tipo_documento, v_snapshot','v_numero_sequencial, p_tipo_documento::public.tipo_documento, v_snapshot');
    EXECUTE v_definition;
  ELSIF position('p_tipo_documento::public.tipo_documento' in v_definition)=0 THEN
    RAISE EXCEPTION 'UNEXPECTED_EMITIR_DOCUMENTO_FINAL_DEFINITION';
  END IF;
END;
$patch$;


-- The student/guardian adapter cannot claim an administrative origin, even if
-- the authenticated user also has an administrative membership.
CREATE OR REPLACE FUNCTION public._aluno_documento_autorizar(p_escola_id uuid,p_aluno_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path TO '' AS $auth$
DECLARE
  v_actor uuid := public.safe_auth_uid();
  v_email text := lower(trim(coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'email','')));
BEGIN
  IF v_actor IS NULL OR public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id
    OR NOT (
      EXISTS (SELECT 1 FROM public.alunos a WHERE a.id=p_aluno_id AND a.escola_id=p_escola_id
        AND (a.usuario_auth_id=v_actor OR a.profile_id=v_actor))
      OR (v_email <> '' AND EXISTS (
        SELECT 1 FROM public.aluno_encarregados ae JOIN public.encarregados e ON e.id=ae.encarregado_id AND e.escola_id=p_escola_id
        WHERE ae.escola_id=p_escola_id AND ae.aluno_id=p_aluno_id AND lower(trim(e.email))=v_email))
    ) THEN RAISE EXCEPTION 'DOCUMENT_STUDENT_FORBIDDEN' USING ERRCODE='42501'; END IF;
END;
$auth$;
REVOKE ALL ON FUNCTION public._aluno_documento_autorizar(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.aluno_documento_acesso(p_escola_id uuid,p_aluno_id uuid,p_session_id uuid,p_matricula_id uuid,p_tipo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $access$
DECLARE v_tipo text; v_result jsonb := '{}'::jsonb;
BEGIN
  PERFORM public._aluno_documento_autorizar(p_escola_id,p_aluno_id);
  IF p_matricula_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.matriculas m WHERE m.id=p_matricula_id AND m.escola_id=p_escola_id
      AND m.aluno_id=p_aluno_id AND m.session_id=p_session_id
  ) THEN RAISE EXCEPTION 'CROSS_YEAR_ENTITY_MISMATCH' USING ERRCODE='42501'; END IF;
  -- The official declaration with notes remains an institutional document;
  -- the dynamic paid boletim retains its dedicated existing contract.
  IF p_tipo IS NOT NULL THEN
    IF p_tipo NOT IN ('declaracao_frequencia','comprovante_matricula','cartao_estudante','ficha_inscricao','historico','certificado')
      THEN RAISE EXCEPTION 'DOCUMENT_TYPE_INVALID' USING ERRCODE='22023'; END IF;
    RETURN public._documento_individual_politica(p_escola_id,p_aluno_id,p_session_id,p_tipo,p_matricula_id,true);
  END IF;
  FOREACH v_tipo IN ARRAY ARRAY['declaracao_frequencia','comprovante_matricula','cartao_estudante','ficha_inscricao','historico','certificado'] LOOP
    v_result := v_result || jsonb_build_object(v_tipo,public._documento_individual_politica(p_escola_id,p_aluno_id,p_session_id,v_tipo,p_matricula_id,true));
  END LOOP;
  RETURN v_result;
END;
$access$;
REVOKE ALL ON FUNCTION public.aluno_documento_acesso(uuid,uuid,uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.aluno_documento_acesso(uuid,uuid,uuid,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.aluno_documento_solicitar(p_escola_id uuid,p_aluno_id uuid,p_session_id uuid,p_matricula_id uuid,p_tipo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $request$
DECLARE
  v_access jsonb; v_serv public.servicos_escola%ROWTYPE;
  v_pedido public.servico_pedidos%ROWTYPE; v_intent uuid; v_status text;
  v_actor uuid := public.safe_auth_uid();
BEGIN
  IF p_tipo IS NULL THEN RAISE EXCEPTION 'DOCUMENT_TYPE_INVALID' USING ERRCODE='22023'; END IF;
  v_access := public.aluno_documento_acesso(p_escola_id,p_aluno_id,p_session_id,p_matricula_id,p_tipo);
  IF coalesce((v_access->>'ok')::boolean,false) IS NOT TRUE THEN RETURN v_access; END IF;
  SELECT * INTO v_serv FROM public.servicos_escola WHERE escola_id=p_escola_id AND codigo=v_access->>'servico_codigo' AND ativo;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'documento_individual:'||p_escola_id::text||':'||p_aluno_id::text||':'||p_session_id::text||':'||v_serv.codigo,0));
  -- Re-evaluate after the shared checkout lock; never create a second charge.
  v_access := public.aluno_documento_acesso(p_escola_id,p_aluno_id,p_session_id,p_matricula_id,p_tipo);
  IF coalesce((v_access->>'ok')::boolean,false) IS NOT TRUE THEN RETURN v_access; END IF;
  IF coalesce((v_access->>'granted')::boolean,false) THEN
    RETURN v_access || jsonb_build_object('status','granted','pagamento_id',v_access->>'pagamento_intent_id');
  END IF;
  IF v_access->>'pedido_id' IS NOT NULL THEN
    SELECT * INTO v_pedido FROM public.servico_pedidos WHERE id=(v_access->>'pedido_id')::uuid
      AND escola_id=p_escola_id AND aluno_id=p_aluno_id AND matricula_id=p_matricula_id;
  END IF;
  IF v_pedido.id IS NULL THEN
    v_status := CASE WHEN (v_access->>'pagamento_obrigatorio')::boolean THEN 'pending_payment' ELSE 'blocked' END;
    INSERT INTO public.servico_pedidos(escola_id,aluno_id,matricula_id,servico_escola_id,status,servico_codigo,servico_nome,valor_cobrado,contexto,created_by)
    VALUES(p_escola_id,p_aluno_id,p_matricula_id,v_serv.id,v_status,v_serv.codigo,v_serv.nome,v_serv.valor_base,
      jsonb_build_object('origem','portal_aluno_documentos','ano_letivo_id',p_session_id,'tipo_documento',p_tipo),v_actor)
    RETURNING * INTO v_pedido;
    IF v_status='pending_payment' THEN
      INSERT INTO public.pagamento_intents(escola_id,aluno_id,servico_pedido_id,amount,method,status,currency,created_by)
      VALUES(p_escola_id,p_aluno_id,v_pedido.id,v_pedido.valor_cobrado,'transfer','draft','AOA',v_actor)
      RETURNING id INTO v_intent;
    END IF;
    INSERT INTO public.audit_logs(escola_id,actor_id,action,entity,entity_id,portal,details)
    VALUES(p_escola_id,v_actor,'SERVICO_SOLICITADO_ALUNO','servico_pedidos',v_pedido.id::text,'aluno',
      jsonb_build_object('matricula_id',p_matricula_id,'session_id',p_session_id,'servico',v_serv.codigo,'valor',v_pedido.valor_cobrado));
  ELSE
    v_intent := (v_access->>'pagamento_intent_id')::uuid;
  END IF;
  RETURN jsonb_build_object('ok',true,'pedido_id',v_pedido.id,'pagamento_id',v_intent,
    'status',CASE WHEN v_access->>'status'='verification' THEN 'pending' WHEN v_pedido.status='granted' THEN 'pending' ELSE v_pedido.status END,
    'valor',v_pedido.valor_cobrado,'matricula_id',p_matricula_id,'session_id',p_session_id);
END;
$request$;
REVOKE ALL ON FUNCTION public.aluno_documento_solicitar(uuid,uuid,uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.aluno_documento_solicitar(uuid,uuid,uuid,uuid,text) TO authenticated;

-- Used by the existing renderers before returning an existing or new document.
CREATE OR REPLACE FUNCTION public._aluno_documento_exigir(p_escola_id uuid,p_aluno_id uuid,p_matricula_id uuid,p_tipo text)
RETURNS void LANGUAGE plpgsql SET search_path TO '' AS $guard$
DECLARE v_session uuid; v_access jsonb;
BEGIN
  SELECT session_id INTO v_session FROM public.matriculas WHERE id=p_matricula_id AND escola_id=p_escola_id AND aluno_id=p_aluno_id;
  v_access:=public.aluno_documento_acesso(p_escola_id,p_aluno_id,v_session,p_matricula_id,p_tipo);
  IF coalesce((v_access->>'granted')::boolean,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'DOCUMENT_ACCESS_DENIED: %',coalesce(v_access->>'reason',v_access->>'status') USING ERRCODE='42501';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'documento:emitido:'||p_escola_id::text||':'||p_aluno_id::text||':'||v_session::text||':'||p_tipo,0));
END;
$guard$;
REVOKE ALL ON FUNCTION public._aluno_documento_exigir(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;

-- Compatibility with the existing rendering RPCs. They retain their snapshots,
-- audit and legal locks, but every direct call now uses the same access decision.
DO $portal_patch$
DECLARE v_sig text; v_tipo text; v_mat text; v_def text; v_marker text := 'SELECT id, public_id, hash_validacao INTO v_doc';
BEGIN
  FOR v_sig,v_tipo,v_mat IN VALUES
    ('public.aluno_emitir_documento_final(uuid,uuid,integer,text)','p_tipo_documento','v_hist.matricula_id'),
    ('public.aluno_emitir_declaracao_frequencia(uuid,uuid,uuid)',quote_literal('declaracao_frequencia'),'p_matricula_id'),
    ('public.aluno_emitir_comprovante_matricula(uuid,uuid,uuid)',quote_literal('comprovante_matricula'),'p_matricula_id'),
    ('public.aluno_emitir_documento_operacional(uuid,uuid,uuid,text)','p_tipo_documento','p_matricula_id')
  LOOP
    IF to_regprocedure(v_sig) IS NULL THEN CONTINUE; END IF;
    SELECT pg_get_functiondef(to_regprocedure(v_sig)) INTO v_def;
    IF position('public._aluno_documento_exigir(' in v_def)=0 THEN
      IF position(v_marker in v_def)=0 THEN RAISE EXCEPTION 'UNEXPECTED_PORTAL_RENDERER: %',v_sig; END IF;
      v_def:=replace(v_def,v_marker,'PERFORM public._aluno_documento_exigir(p_escola_id,p_aluno_id,'||v_mat||','||v_tipo||'); '||v_marker);
      IF v_sig LIKE '%aluno_emitir_documento_final%' THEN
        v_def:=replace(v_def,'dados_snapshot->>''ano_letivo'' = p_ano_letivo::text','dados_snapshot->>''matricula_id'' = v_hist.matricula_id::text');
      END IF;
      EXECUTE v_def;
    END IF;
  END LOOP;
END;
$portal_patch$;

-- Block old document requests without an explicit academic scope. Non-document
-- services keep their existing contract; the published frontend is coordinated
-- with this migration before removing access to the legacy path.
DO $legacy_request$
DECLARE v_def text; v_marker text := 'SELECT * INTO v_serv FROM public.servicos_escola';
BEGIN
  IF to_regprocedure('public.aluno_solicitar_servico(uuid,uuid,text)') IS NOT NULL THEN
    SELECT pg_get_functiondef('public.aluno_solicitar_servico(uuid,uuid,text)'::regprocedure) INTO v_def;
    IF position('DOCUMENT_EXPLICIT_YEAR_REQUIRED' in v_def)=0 THEN
      IF position(v_marker in v_def)=0 THEN RAISE EXCEPTION 'UNEXPECTED_LEGACY_SERVICE_REQUEST'; END IF;
      v_def:=replace(v_def,v_marker,'IF p_servico_codigo IN (''DOC_DECLARACAO_FREQUENCIA'',''DOC_DECLARACAO_NOTAS'',''DOC_COMPROVANTE_MATRICULA'',''DOC_CARTAO_ESTUDANTE'',''DOC_FICHA_INSCRICAO'',''DOC_HISTORICO_ESCOLAR'',''DOC_CERTIFICADO_HABILITACOES'',''DOC_BOLETIM_TRIMESTRAL'') THEN RAISE EXCEPTION ''DOCUMENT_EXPLICIT_YEAR_REQUIRED'' USING ERRCODE=''22023''; END IF; '||v_marker);
      EXECUTE v_def;
    END IF;
  END IF;
END;
$legacy_request$;

-- The final idempotent wrapper is reached by the authorized staff adapter.
DO $roles$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.emitir_documento_final_idempotente(uuid,uuid,integer,text,text)'::regprocedure) INTO v_def;
  IF position('''admin_secretaria''' in v_def)=0 THEN
    IF position('''staff_admin''' in v_def)=0 THEN RAISE EXCEPTION 'UNEXPECTED_DOCUMENT_ROLE_WRAPPER'; END IF;
    EXECUTE replace(v_def,'''staff_admin''','''staff_admin'',''admin_secretaria'',''diretor''');
  END IF;
END;
$roles$;

COMMIT;
