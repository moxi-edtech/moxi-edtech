\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE v_school uuid:='00000000-0000-4000-8000-000000000001'; v_lote jsonb; v_id uuid; v_retry uuid; v_created boolean;
BEGIN
 IF has_function_privilege('authenticated','provas_private.provas_importar_sistema(uuid,jsonb)','EXECUTE') OR has_function_privilege('anon','provas_private.provas_importar_sistema(uuid,jsonb)','EXECUTE') OR has_function_privilege('service_role','provas_private.provas_importar_sistema(uuid,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'import grants leaked'; END IF;
 v_lote:='[{"chave":"test-import-v1","dados":{"ano_letivo_id":"20000000-0000-4000-8000-000000000001","curso_matriz_id":"70000000-0000-4000-8000-000000000001","trimestre":1,"titulo":"Prova sintética","duracao":90,"serie":"A","conteudo":[{"tipo":"discursiva","texto":"Questão sintética","linhas":2,"cotacao_cent":2000}]}}]'::jsonb;
 SELECT prova_id,criada INTO STRICT v_id,v_created FROM provas_private.provas_importar_sistema(v_school,v_lote);
 IF NOT v_created OR NOT EXISTS(SELECT 1 FROM public.provas_pedagogicas WHERE id=v_id AND autor_id IS NULL AND autor_tipo='sistema' AND estado='rascunho' AND versao=1) THEN RAISE EXCEPTION 'system draft creation failed'; END IF;
 SELECT prova_id,criada INTO STRICT v_retry,v_created FROM provas_private.provas_importar_sistema(v_school,v_lote);
 IF v_retry<>v_id OR v_created THEN RAISE EXCEPTION 'retry duplicated'; END IF;
 BEGIN
  PERFORM provas_private.provas_importar_sistema(v_school,jsonb_set(v_lote,'{0,dados,titulo}','"Alterada"'));
  RAISE EXCEPTION 'changed payload accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  PERFORM provas_private.provas_importar_sistema(v_school,jsonb_set(v_lote,'{0,chave}','"batch-rollback"') || jsonb_set(jsonb_set(v_lote,'{0,chave}','"wrong-scale"'),'{0,dados,conteudo,0,cotacao_cent}','1000'));
  RAISE EXCEPTION 'wrong scale accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 IF EXISTS(SELECT 1 FROM public.provas_pedagogicas WHERE importacao_chave='batch-rollback') THEN RAISE EXCEPTION 'partial batch persisted'; END IF;
 BEGIN
  PERFORM provas_private.provas_importar_sistema('00000000-0000-4000-8000-000000000002',v_lote);
  RAISE EXCEPTION 'cross tenant import accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('test.system_exam_id',v_id::text,true);
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
DO $$
DECLARE v_id uuid:=current_setting('test.system_exam_id')::uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.provas_pedagogicas WHERE id=v_id) THEN RAISE EXCEPTION 'assigned system draft unavailable to teacher'; END IF;
 BEGIN
  PERFORM public.provas_mutar('00000000-0000-4000-8000-000000000001',v_id,1,'arquivar',NULL);
  RAISE EXCEPTION 'teacher archived shared system draft';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
DO $$
DECLARE v_id uuid:=current_setting('test.system_exam_id')::uuid; r public.provas_pedagogicas;
BEGIN
 SELECT * INTO r FROM public.provas_pedagogicas WHERE id=v_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'admin cannot review import'; END IF;
 SELECT * INTO r FROM public.provas_mutar('00000000-0000-4000-8000-000000000001',v_id,1,'submeter',NULL);
 IF r.estado<>'em_revisao' OR r.autor_id IS NOT NULL THEN RAISE EXCEPTION 'admin submission failed'; END IF;
END $$;
ROLLBACK;
