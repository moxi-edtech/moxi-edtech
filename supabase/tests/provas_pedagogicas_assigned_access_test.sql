\set ON_ERROR_STOP on
BEGIN;
DO $fixture$
DECLARE school uuid:='00000000-0000-4000-8000-000000000001'; data jsonb; p uuid; m uuid;
BEGIN
 data:='{"ano_letivo_id":"20000000-0000-4000-8000-000000000001","curso_matriz_id":"70000000-0000-4000-8000-000000000001","trimestre":1,"titulo":"Prova sintética de Física","duracao":90,"serie":"A","conteudo":[{"tipo":"discursiva","texto":"Pergunta sintética","linhas":2,"cotacao_cent":2000}]}'::jsonb;
 SELECT prova_id INTO STRICT p FROM provas_private.provas_importar_sistema(school,jsonb_build_array(jsonb_build_object('chave','assigned-physics','dados',data)));
 SELECT prova_id INTO STRICT m FROM provas_private.provas_importar_sistema(school,jsonb_build_array(jsonb_build_object('chave','assigned-math','dados',data||'{"curso_matriz_id":"70000000-0000-4000-8000-000000000002","titulo":"Matemática sintética"}')));
 PERFORM set_config('test.physics',p::text,true); PERFORM set_config('test.math',m::text,true); PERFORM set_config('test.exam_data',data::text,true);
END;
$fixture$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
DO $teacher$
DECLARE school uuid:='00000000-0000-4000-8000-000000000001'; p uuid:=current_setting('test.physics')::uuid; m uuid:=current_setting('test.math')::uuid; data jsonb:=current_setting('test.exam_data')::jsonb; r public.provas_pedagogicas; a text;
BEGIN
 IF (SELECT count(*) FROM public.provas_pedagogicas)<>1 OR NOT EXISTS(SELECT 1 FROM public.provas_pedagogicas WHERE id=p) THEN RAISE EXCEPTION 'teacher scope incorrect'; END IF;
 BEGIN
  PERFORM public.provas_mutar(school,m,1,'guardar',data);
  RAISE EXCEPTION 'unassigned source editable';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 FOREACH a IN ARRAY ARRAY['arquivar','duplicar','aprovar','devolver'] LOOP
  BEGIN
   PERFORM public.provas_mutar(school,p,1,a,NULL);
   RAISE EXCEPTION 'shared system forbidden action accepted: %',a;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 END LOOP;
 BEGIN
  PERFORM public.provas_mutar(school,p,1,'guardar',data||'{"trimestre":2}');
  RAISE EXCEPTION 'shared system moved to another trimester';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 r:=public.provas_mutar(school,p,1,'guardar',data||'{"titulo":"Primeira edição"}');
 IF r.versao<>2 OR r.autor_id IS NOT NULL OR r.autor_tipo<>'sistema' OR r.titulo<>'Primeira edição' THEN RAISE EXCEPTION 'shared system edit failed'; END IF;
 r:=public.provas_mutar(school,NULL,NULL,'criar',data);
 PERFORM set_config('test.personal',r.id::text,true);
END;
$teacher$;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
DO $collaborator$
DECLARE school uuid:='00000000-0000-4000-8000-000000000001'; p uuid:=current_setting('test.physics')::uuid; data jsonb:=current_setting('test.exam_data')::jsonb; r public.provas_pedagogicas;
BEGIN
 -- Teacher 2 has Mathematics directly and Physics through turma_disciplinas_professores.
 IF (SELECT count(*) FROM public.provas_pedagogicas)<>2 OR EXISTS(SELECT 1 FROM public.provas_pedagogicas WHERE id=current_setting('test.personal')::uuid) THEN RAISE EXCEPTION 'secondary assignment or personal privacy failed'; END IF;
 BEGIN
  PERFORM public.provas_mutar(school,p,1,'guardar',data);
  RAISE EXCEPTION 'stale collaborative save accepted';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 r:=public.provas_mutar(school,p,2,'guardar',data||'{"titulo":"Segunda edição"}');
 IF r.versao<>3 OR r.autor_tipo<>'sistema' OR r.autor_id IS NOT NULL THEN RAISE EXCEPTION 'collaborative save failed'; END IF;
 BEGIN
  PERFORM public.provas_mutar(school,p,3,'guardar',data||'{"curso_matriz_id":"70000000-0000-4000-8000-000000000002"}');
  RAISE EXCEPTION 'shared system moved to another assigned discipline';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 r:=public.provas_mutar(school,p,3,'submeter',NULL);
 IF r.estado<>'em_revisao' OR r.versao<>4 THEN RAISE EXCEPTION 'teacher submission failed'; END IF;
 BEGIN
  PERFORM public.provas_mutar(school,p,4,'guardar',data);
  RAISE EXCEPTION 'review-state edit allowed';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END;
$collaborator$;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000006',true);
DO $tenant$
BEGIN
 IF EXISTS(SELECT 1 FROM public.provas_pedagogicas) THEN RAISE EXCEPTION 'foreign tenant read'; END IF;
 BEGIN
  PERFORM public.provas_mutar('00000000-0000-4000-8000-000000000001',current_setting('test.physics')::uuid,4,'aprovar',NULL);
  RAISE EXCEPTION 'foreign tenant mutation';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$tenant$;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000007',true);
DO $finance$
DECLARE r public.provas_pedagogicas;
BEGIN
 IF (SELECT count(*) FROM public.provas_pedagogicas)<>3 THEN RAISE EXCEPTION 'financial admin access incomplete'; END IF;
 r:=public.provas_mutar('00000000-0000-4000-8000-000000000001',current_setting('test.physics')::uuid,4,'aprovar',NULL);
 IF r.estado<>'aprovada' OR r.versao<>5 THEN RAISE EXCEPTION 'financial admin approval failed'; END IF;
END;
$finance$;
RESET ROLE;
DO $audit$
BEGIN
 IF (SELECT count(*) FROM public.audit_logs WHERE entity_id=current_setting('test.physics'))<>4 THEN RAISE EXCEPTION 'missing or nontransactional audit events'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.audit_logs WHERE entity_id=current_setting('test.physics') AND actor_id='10000000-0000-4000-8000-000000000001' AND details->>'versao'='2') OR NOT EXISTS(SELECT 1 FROM public.audit_logs WHERE entity_id=current_setting('test.physics') AND actor_id='10000000-0000-4000-8000-000000000002' AND details->>'versao'='3') THEN RAISE EXCEPTION 'actor attribution missing'; END IF;
 IF EXISTS(SELECT 1 FROM public.audit_logs WHERE details ? 'conteudo' OR details::text LIKE '%Pergunta sintética%') THEN RAISE EXCEPTION 'confidential exam logged'; END IF;
END;
$audit$;
-- Remove the direct assignment; teacher 2's independent link must remain valid.
UPDATE public.turma_disciplinas SET professor_id=NULL WHERE professor_id='90000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
DO $revoked$
BEGIN
 IF EXISTS(SELECT 1 FROM public.provas_pedagogicas) THEN RAISE EXCEPTION 'revoked teacher still sees system or own exam'; END IF;
 BEGIN
  PERFORM public.provas_mutar('00000000-0000-4000-8000-000000000001',current_setting('test.personal')::uuid,1,'arquivar',NULL);
  RAISE EXCEPTION 'revoked teacher mutated personal draft';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$revoked$;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
DO $remaining$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.provas_pedagogicas WHERE id=current_setting('test.physics')::uuid AND estado='aprovada') THEN RAISE EXCEPTION 'approved assigned exam unavailable'; END IF;
END;
$remaining$;
RESET ROLE;
DELETE FROM public.turma_disciplinas_professores WHERE professor_id='90000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
DO $link_revoked$
BEGIN
 IF EXISTS(SELECT 1 FROM public.provas_pedagogicas WHERE id=current_setting('test.physics')::uuid) OR (SELECT count(*) FROM public.provas_pedagogicas)<>1 THEN RAISE EXCEPTION 'secondary assignment revocation failed'; END IF;
END;
$link_revoked$;
ROLLBACK;
