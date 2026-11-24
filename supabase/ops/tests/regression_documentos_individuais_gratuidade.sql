-- Test after the original regression and the new migration on a disposable DB.
BEGIN;
INSERT INTO public.escolas(id,nome,status) VALUES ('00000000-0000-4000-8000-000000007101','Escola gratuidades','ativa');
INSERT INTO auth.users(id,email) VALUES ('00000000-0000-4000-8000-000000007103','gratuidade@documentos-klasse.test');
INSERT INTO public.escola_users(escola_id,user_id,role,papel) VALUES ('00000000-0000-4000-8000-000000007101','00000000-0000-4000-8000-000000007103','staff','secretaria');
INSERT INTO public.alunos(id,escola_id,nome) VALUES ('00000000-0000-4000-8000-000000007105','00000000-0000-4000-8000-000000007101','Aluno');
INSERT INTO public.anos_letivos(id,escola_id,ano) VALUES ('00000000-0000-4000-8000-000000007106','00000000-0000-4000-8000-000000007101',2026);
INSERT INTO public.matriculas(id,escola_id,aluno_id,session_id,status) VALUES ('00000000-0000-4000-8000-000000007108','00000000-0000-4000-8000-000000007101','00000000-0000-4000-8000-000000007105','00000000-0000-4000-8000-000000007106','concluido');
INSERT INTO public.historico_anos(id,escola_id,aluno_id,ano_letivo,matricula_id,snapshot_status) VALUES ('00000000-0000-4000-8000-000000007110','00000000-0000-4000-8000-000000007101','00000000-0000-4000-8000-000000007105',2026,'00000000-0000-4000-8000-000000007108','fechado');
INSERT INTO public.historico_disciplinas(id,historico_ano_id,disciplina_nome,nota_final) VALUES ('00000000-0000-4000-8000-000000007112','00000000-0000-4000-8000-000000007110','Matemática',15);
INSERT INTO public.servicos_escola(escola_id,codigo,nome,valor_base,exige_pagamento_antes_de_liberar,exige_aprovacao) VALUES
 ('00000000-0000-4000-8000-000000007101','DOC_DECLARACAO_NOTAS','Declaração com notas',0,false,false),
 ('00000000-0000-4000-8000-000000007101','DOC_CERTIFICADO_HABILITACOES','Certificado',0,false,true),
 ('00000000-0000-4000-8000-000000007101','DOC_DECLARACAO_FREQUENCIA','Declaração simples',0,true,false),
 ('00000000-0000-4000-8000-000000007101','DOC_BOLETIM_TRIMESTRAL','Boletim',0,false,false);
UPDATE public.alunos SET usuario_auth_id='00000000-0000-4000-8000-000000007105' WHERE id='00000000-0000-4000-8000-000000007105';
SET LOCAL ROLE authenticated;
DO $$
DECLARE s uuid := '00000000-0000-4000-8000-000000007101'; a uuid := '00000000-0000-4000-8000-000000007105'; y uuid := '00000000-0000-4000-8000-000000007106'; v jsonb; w jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims',json_build_object('sub','00000000-0000-4000-8000-000000007103','role','authenticated','escola_id',s)::text,true);
  v := public.documento_individual_acesso(s,a,y,'declaracao_notas');
  IF v->>'status' IS DISTINCT FROM 'free' OR (v->>'granted')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'FREE_DECLARATION_BLOCKED: %',v; END IF;
  v := public.documento_individual_acesso(s,a,y,'certificado');
  IF v->>'status' IS DISTINCT FROM 'free' OR (v->>'granted')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'STAFF_FREE_CERTIFICATE_BLOCKED: %',v; END IF;
  v := public.documento_individual_solicitar(s,a,y,'certificado');
  IF v->>'pedido_id' IS NOT NULL OR v->>'pagamento_intent_id' IS NOT NULL THEN RAISE EXCEPTION 'STAFF_CREATED_REDUNDANT_APPROVAL: %',v; END IF;
  IF public.documento_individual_acesso(s,a,y,'declaracao_frequencia')->>'reason' IS DISTINCT FROM 'TAXA_NAO_CONFIGURADA' THEN RAISE EXCEPTION 'MISCONFIGURED_PAID_SERVICE_ALLOWED'; END IF;
  IF public.documento_individual_acesso(s,a,y,'boletim_trimestral')->>'reason' IS DISTINCT FROM 'TAXA_NAO_CONFIGURADA' THEN RAISE EXCEPTION 'PAID_BOLETIM_BYPASSED'; END IF;
END; $$;
RESET ROLE;
-- A política privada é exercitada pelo dono da função, com identidade de aluno.
DO $$
DECLARE s uuid := '00000000-0000-4000-8000-000000007101'; a uuid := '00000000-0000-4000-8000-000000007105'; y uuid := '00000000-0000-4000-8000-000000007106'; v jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims',json_build_object('sub','00000000-0000-4000-8000-000000007105','role','authenticated','escola_id',s)::text,true);
  v := public._documento_individual_politica(s,a,y,'certificado',NULL);
  IF v->>'status' IS DISTINCT FROM 'approval' OR (v->>'granted')::boolean IS DISTINCT FROM false THEN RAISE EXCEPTION 'STUDENT_APPROVAL_BYPASS: %',v; END IF;
  BEGIN
    INSERT INTO public.documentos_emitidos(escola_id,aluno_id,tipo,dados_snapshot,hash_validacao)
    VALUES (s,a,'certificado',jsonb_build_object('matricula_id','00000000-0000-4000-8000-000000007108','ano_letivo',2026),'student-guard-hash');
    RAISE EXCEPTION 'STUDENT_INSERT_BYPASS';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claims',json_build_object('sub','00000000-0000-4000-8000-000000007103','role','authenticated','escola_id',s)::text,true);
END; $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE v jsonb;
BEGIN
 v := public.documento_individual_acesso('00000000-0000-4000-8000-000000007101','00000000-0000-4000-8000-000000007105','00000000-0000-4000-8000-000000007106','certificado');
 IF v->>'status' IS DISTINCT FROM 'free' OR (v->>'granted')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'STAFF_FREE_CERTIFICATE_BLOCKED: %',v; END IF;
 PERFORM public.emitir_documento_final('00000000-0000-4000-8000-000000007101','00000000-0000-4000-8000-000000007105',2026,'certificado');
END; $$;
RESET ROLE;
DO $$
DECLARE v_id uuid;
BEGIN
 IF has_function_privilege('authenticated','public._documento_individual_politica(uuid,uuid,uuid,text,uuid,boolean)','EXECUTE')
 OR has_function_privilege('anon','public._documento_individual_politica(uuid,uuid,uuid,text,uuid,boolean)','EXECUTE')
 THEN RAISE EXCEPTION 'PRIVATE_POLICY_EXPOSED'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.documentos_emitidos WHERE escola_id='00000000-0000-4000-8000-000000007101' AND tipo::text='certificado') THEN RAISE EXCEPTION 'STAFF_PERSISTENCE_FAILED'; END IF;
 BEGIN
   INSERT INTO public.documentos_emitidos(escola_id,aluno_id,tipo,dados_snapshot,hash_validacao)
   VALUES ('00000000-0000-4000-8000-000000007101','00000000-0000-4000-8000-000000007105','declaracao_frequencia',
   jsonb_build_object('matricula_id','00000000-0000-4000-8000-000000007108','ano_letivo',2026),'guard-test-hash');
   RAISE EXCEPTION 'DIRECT_INSERT_PAYMENT_BYPASS';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END;
$$;
-- Portal must request the exact closed year and never get the staff exemption.
SET LOCAL ROLE authenticated;
DO $portaltest$
DECLARE s uuid := '00000000-0000-4000-8000-000000007101'; a uuid := '00000000-0000-4000-8000-000000007105'; y uuid := '00000000-0000-4000-8000-000000007106'; m uuid := '00000000-0000-4000-8000-000000007108'; v jsonb; w jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated','escola_id',s)::text,true);
  v:=public.aluno_documento_acesso(s,a,y,m,'certificado');
  IF v->>'status' IS DISTINCT FROM 'approval' THEN RAISE EXCEPTION 'PORTAL_APPROVAL_BYPASS: %',v; END IF;
  v:=public.aluno_documento_solicitar(s,a,y,m,'certificado');
  w:=public.aluno_documento_solicitar(s,a,y,m,'certificado');
  IF v->>'status' IS DISTINCT FROM 'blocked' OR v->>'pedido_id' IS NULL OR v->>'pedido_id' IS DISTINCT FROM w->>'pedido_id' THEN RAISE EXCEPTION 'PORTAL_REQUEST_NOT_IDEMPOTENT: % %',v,w; END IF;
  BEGIN
    PERFORM public.aluno_documento_acesso(s,a,'00000000-0000-4000-8000-000000007999',m,'certificado');
    RAISE EXCEPTION 'PORTAL_CROSS_YEAR_BYPASS';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.aluno_documento_acesso(s,'00000000-0000-4000-8000-000000007999',y,m,'certificado');
    RAISE EXCEPTION 'PORTAL_OTHER_STUDENT_BYPASS';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$portaltest$;
RESET ROLE;
UPDATE public.servico_pedidos SET status='granted' WHERE escola_id='00000000-0000-4000-8000-000000007101' AND servico_codigo='DOC_CERTIFICADO_HABILITACOES';
SET LOCAL ROLE authenticated;
DO $approved$
DECLARE v jsonb;
BEGIN
  v:=public.aluno_documento_acesso('00000000-0000-4000-8000-000000007101','00000000-0000-4000-8000-000000007105','00000000-0000-4000-8000-000000007106','00000000-0000-4000-8000-000000007108','certificado');
  IF (v->>'granted')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'PORTAL_APPROVED_BLOCKED: %',v; END IF;
END;
$approved$;
RESET ROLE;
UPDATE public.historico_disciplinas SET nota_final=NULL WHERE historico_ano_id='00000000-0000-4000-8000-000000007110';
UPDATE public.servicos_escola SET valor_base=1000, exige_pagamento_antes_de_liberar=true WHERE escola_id='00000000-0000-4000-8000-000000007101' AND codigo='DOC_DECLARACAO_NOTAS';
SET LOCAL ROLE authenticated;
DO $notastest$
DECLARE v jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims',json_build_object('sub','00000000-0000-4000-8000-000000007103','role','authenticated','escola_id','00000000-0000-4000-8000-000000007101')::text,true);
  v:=public.documento_individual_solicitar('00000000-0000-4000-8000-000000007101','00000000-0000-4000-8000-000000007105','00000000-0000-4000-8000-000000007106','declaracao_notas');
  IF v->>'reason' IS DISTINCT FROM 'NOTAS_INCOMPLETAS' OR v->>'pagamento_intent_id' IS NOT NULL THEN RAISE EXCEPTION 'NOTES_CHARGED_BEFORE_ELIGIBILITY: %',v; END IF;
END;
$notastest$;
RESET ROLE;
DO $roles_test$
DECLARE v_role text; v jsonb;
BEGIN
  FOREACH v_role IN ARRAY ARRAY['admin_secretaria','diretor'] LOOP
    UPDATE public.escola_users SET papel=v_role WHERE escola_id='00000000-0000-4000-8000-000000007101' AND user_id='00000000-0000-4000-8000-000000007103';
    v:=public.documento_individual_acesso('00000000-0000-4000-8000-000000007101','00000000-0000-4000-8000-000000007105','00000000-0000-4000-8000-000000007106','certificado');
    IF v->>'reason' IS DISTINCT FROM 'NOTAS_INCOMPLETAS' THEN RAISE EXCEPTION 'ROLE_AUTHZ_MISMATCH % %',v_role,v; END IF;
  END LOOP;
END;
$roles_test$;
-- Price changes must not invalidate a settled service, nor split a cross-channel request.
UPDATE public.historico_disciplinas SET nota_final=15 WHERE historico_ano_id='00000000-0000-4000-8000-000000007110';
UPDATE public.servicos_escola SET valor_base=1000,exige_pagamento_antes_de_liberar=true WHERE escola_id='00000000-0000-4000-8000-000000007101' AND codigo='DOC_DECLARACAO_NOTAS';
SET LOCAL ROLE authenticated;
DO $cross$
DECLARE s uuid:='00000000-0000-4000-8000-000000007101'; a uuid:='00000000-0000-4000-8000-000000007105'; y uuid:='00000000-0000-4000-8000-000000007106'; m uuid:='00000000-0000-4000-8000-000000007108'; v jsonb; w jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated','escola_id',s)::text,true);
  v:=public.aluno_documento_solicitar(s,a,y,m,'declaracao_notas');
  IF v->>'status' IS DISTINCT FROM 'pending_payment' OR v->>'pagamento_id' IS NULL THEN RAISE EXCEPTION 'PORTAL_NOTES_REQUEST_FAILED %',v; END IF;
  PERFORM set_config('request.jwt.claims',json_build_object('sub','00000000-0000-4000-8000-000000007103','role','authenticated','escola_id',s)::text,true);
  w:=public.documento_individual_solicitar(s,a,y,'declaracao_notas');
  IF w->>'pedido_id' IS DISTINCT FROM v->>'pedido_id' OR w->>'pagamento_intent_id' IS DISTINCT FROM v->>'pagamento_id' THEN RAISE EXCEPTION 'CROSS_CHANNEL_DUPLICATE % %',v,w; END IF;
END;
$cross$;
RESET ROLE;
UPDATE public.pagamento_intents SET status='settled' WHERE servico_pedido_id IN (SELECT id FROM public.servico_pedidos WHERE escola_id='00000000-0000-4000-8000-000000007101' AND servico_codigo='DOC_DECLARACAO_NOTAS');
UPDATE public.servico_pedidos SET status='granted' WHERE escola_id='00000000-0000-4000-8000-000000007101' AND servico_codigo='DOC_DECLARACAO_NOTAS';
UPDATE public.servicos_escola SET valor_base=3000 WHERE escola_id='00000000-0000-4000-8000-000000007101' AND codigo='DOC_DECLARACAO_NOTAS';
SET LOCAL ROLE authenticated;
DO $price$
DECLARE s uuid:='00000000-0000-4000-8000-000000007101'; a uuid:='00000000-0000-4000-8000-000000007105'; y uuid:='00000000-0000-4000-8000-000000007106'; m uuid:='00000000-0000-4000-8000-000000007108'; v jsonb; w jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated','escola_id',s)::text,true);
  v:=public.aluno_documento_acesso(s,a,y,m,'declaracao_notas');
  IF v->>'status' IS DISTINCT FROM 'paid' OR (v->>'valor')::numeric<>1000 THEN RAISE EXCEPTION 'PRICE_CHANGE_INVALIDATED_PAYMENT %',v; END IF;
  v:=public.aluno_emitir_documento_final(s,a,2026,'declaracao_notas');
  w:=public.aluno_emitir_documento_final(s,a,2026,'declaracao_notas');
  IF v->>'docId' IS NULL OR v->>'docId' IS DISTINCT FROM w->>'docId' THEN RAISE EXCEPTION 'NOTES_REPRINT_DUPLICATE'; END IF;
END;
$price$;
RESET ROLE;
INSERT INTO public.servico_pedidos(escola_id,aluno_id,matricula_id,servico_escola_id,status,servico_codigo,servico_nome,valor_cobrado,contexto)
SELECT s.escola_id,'00000000-0000-4000-8000-000000007105','00000000-0000-4000-8000-000000007108',s.id,'blocked',s.codigo,'Fila teste '||n,0,jsonb_build_object('origem','portal_aluno_documentos')
FROM public.servicos_escola s CROSS JOIN generate_series(1,65) n WHERE s.escola_id='00000000-0000-4000-8000-000000007101' AND s.codigo='DOC_CERTIFICADO_HABILITACOES';
SET LOCAL ROLE authenticated;
DO $queue_test$
DECLARE v jsonb; w jsonb;
BEGIN
 PERFORM set_config('request.jwt.claims',json_build_object('sub','00000000-0000-4000-8000-000000007103','role','authenticated','escola_id','00000000-0000-4000-8000-000000007101')::text,true);
 v:=public.documentos_aprovacoes_pagina('00000000-0000-4000-8000-000000007101',7,'');
 w:=public.documentos_aprovacoes_pagina('00000000-0000-4000-8000-000000007101',1,'fila teste 65');
 IF (v->>'total')::integer<>65 OR jsonb_array_length(v->'items')<>5 OR (w->>'filteredTotal')::integer<>1 THEN RAISE EXCEPTION 'QUEUE_PAGINATION_FAILED % %',v,w; END IF;
END;
$queue_test$;
RESET ROLE;
-- Lote service_role only: the same persisted certificate is reused, and the
-- actor is derived from the job, not from a caller-supplied escola or aluno.
INSERT INTO public.turmas(id,escola_id,session_id) VALUES ('00000000-0000-4000-8000-000000007120','00000000-0000-4000-8000-000000007101','00000000-0000-4000-8000-000000007106');
UPDATE public.matriculas SET turma_id='00000000-0000-4000-8000-000000007120' WHERE id='00000000-0000-4000-8000-000000007108';
INSERT INTO public.pautas_lote_jobs(id,escola_id,created_by,tipo,status) VALUES ('00000000-0000-4000-8000-000000007121','00000000-0000-4000-8000-000000007101','00000000-0000-4000-8000-000000007103','certificado','PROCESSING');
INSERT INTO public.pautas_lote_itens(job_id,turma_id) VALUES ('00000000-0000-4000-8000-000000007121','00000000-0000-4000-8000-000000007120');
DO $workergrant$
BEGIN
 IF has_function_privilege('authenticated','public.documento_final_lote_item(uuid,uuid,uuid,text)','EXECUTE') OR has_function_privilege('anon','public.documento_final_lote_item(uuid,uuid,uuid,text)','EXECUTE') THEN RAISE EXCEPTION 'WORKER_RPC_EXPOSED'; END IF;
END;
$workergrant$;
SET LOCAL ROLE service_role;
DO $worker$
DECLARE v jsonb; w jsonb;
BEGIN
 PERFORM set_config('request.jwt.claims',json_build_object('role','service_role')::text,true);
 v:=public.documento_final_lote_item('00000000-0000-4000-8000-000000007121','00000000-0000-4000-8000-000000007120','00000000-0000-4000-8000-000000007108','certificado');
 w:=public.documento_final_lote_item('00000000-0000-4000-8000-000000007121','00000000-0000-4000-8000-000000007120','00000000-0000-4000-8000-000000007108','certificado');
 IF v->>'docId' IS NULL OR v->>'docId' IS DISTINCT FROM w->>'docId' OR (v->>'reused')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'BATCH_DUPLICATE_OR_MISSING'; END IF;
 BEGIN
   PERFORM public.documento_final_lote_item('00000000-0000-4000-8000-000000007121','00000000-0000-4000-8000-000000007999','00000000-0000-4000-8000-000000007108','certificado');
   RAISE EXCEPTION 'BATCH_WRONG_TURMA_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$worker$;
RESET ROLE;
ROLLBACK;
