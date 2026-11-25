\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
DO $$
DECLARE r public.provas_pedagogicas;
 v_school uuid:='00000000-0000-4000-8000-000000000001';
 v_data jsonb:='{"titulo":"Prova","classe":"8ª","disciplina":"Física","ano_lectivo":"2026/2027","trimestre":1,"duracao":90,"serie":"A","conteudo":[{"tipo":"discursiva","texto":"Questão confidencial","linhas":3}]}';
BEGIN
 r:=public.provas_mutar(v_school,NULL,NULL,'criar',v_data);
 IF r.estado<>'rascunho' OR r.versao<>1 OR r.autor_id<>auth.uid() THEN RAISE EXCEPTION 'create failed'; END IF;
 PERFORM set_config('test.prova_id',r.id::text,true);
 BEGIN
   PERFORM public.provas_mutar('00000000-0000-4000-8000-000000000002',NULL,NULL,'criar',v_data);
   RAISE EXCEPTION 'cross-school creation allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   UPDATE public.provas_pedagogicas SET estado='aprovada' WHERE id=r.id;
   RAISE EXCEPTION 'direct update allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 r:=public.provas_mutar(v_school,r.id,r.versao,'guardar',v_data);
 IF r.versao<>2 THEN RAISE EXCEPTION 'save failed'; END IF;
 BEGIN
   PERFORM public.provas_mutar(v_school,r.id,1,'guardar',v_data);
   RAISE EXCEPTION 'stale write allowed';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN
   PERFORM public.provas_mutar(v_school,r.id,r.versao,'guardar',jsonb_set(v_data,'{conteudo,0,linhas}','999'));
   RAISE EXCEPTION 'invalid lines allowed';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
-- Other teacher, student, secretary and other-school admin cannot read draft.
DO $$
DECLARE u text;
BEGIN
 FOREACH u IN ARRAY ARRAY['10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000006'] LOOP
   PERFORM set_config('request.jwt.claim.sub',u,true);
   IF EXISTS(SELECT 1 FROM public.provas_pedagogicas) THEN RAISE EXCEPTION 'draft leak to %',u; END IF;
 END LOOP;
END $$;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
DO $$
DECLARE r public.provas_pedagogicas;
BEGIN
 r:=public.provas_mutar('00000000-0000-4000-8000-000000000001',current_setting('test.prova_id')::uuid,2,'submeter',NULL);
 IF r.estado<>'em_revisao' THEN RAISE EXCEPTION 'submit failed'; END IF;
 BEGIN
  PERFORM public.provas_mutar(r.escola_id,r.id,r.versao,'aprovar',NULL);
  RAISE EXCEPTION 'teacher approval allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
DO $$
DECLARE r public.provas_pedagogicas;
BEGIN
 r:=public.provas_mutar('00000000-0000-4000-8000-000000000001',current_setting('test.prova_id')::uuid,3,'aprovar',NULL);
 IF r.estado<>'aprovada' OR r.aprovado_por<>auth.uid() THEN RAISE EXCEPTION 'approval failed'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
DO $$
BEGIN
 IF (SELECT count(*) FROM public.provas_pedagogicas)<>1 THEN RAISE EXCEPTION 'secretary cannot read approved'; END IF;
 BEGIN
  PERFORM public.provas_mutar('00000000-0000-4000-8000-000000000001',current_setting('test.prova_id')::uuid,4,'arquivar',NULL);
  RAISE EXCEPTION 'secretary mutation allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
DO $$
DECLARE u text;
BEGIN
 FOREACH u IN ARRAY ARRAY['10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000006'] LOOP
   PERFORM set_config('request.jwt.claim.sub',u,true);
   IF EXISTS(SELECT 1 FROM public.provas_pedagogicas) THEN RAISE EXCEPTION 'approved leak to %',u; END IF;
 END LOOP;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$
BEGIN
 BEGIN
  PERFORM * FROM public.provas_pedagogicas;
  RAISE EXCEPTION 'anon read allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
