\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
DO $$
DECLARE r public.provas_pedagogicas;
 v_school uuid:='00000000-0000-4000-8000-000000000001';
 v_data jsonb:='{"ano_letivo_id":"20000000-0000-4000-8000-000000000001","curso_matriz_id":"70000000-0000-4000-8000-000000000001","titulo":"Prova","classe":"8ª","disciplina":"Física","ano_lectivo":"2026/2027","trimestre":1,"duracao":90,"serie":"A","conteudo":[{"tipo":"discursiva","texto":"Questão confidencial","linhas":3}]}';
BEGIN
 IF jsonb_array_length(public.provas_contexto(v_school,'20000000-0000-4000-8000-000000000001'))<>2 THEN RAISE EXCEPTION 'teacher context leaked or missing'; END IF;
 BEGIN
   PERFORM public.provas_mutar(v_school,NULL,NULL,'criar',jsonb_set(v_data,'{curso_matriz_id}','"70000000-0000-4000-8000-000000000002"'));
   RAISE EXCEPTION 'unassigned discipline accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   PERFORM public.provas_mutar(v_school,NULL,NULL,'criar',jsonb_set(v_data,'{curso_matriz_id}','"70000000-0000-4000-8000-000000000003"'));
   RAISE EXCEPTION 'draft curriculum accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   PERFORM public.provas_mutar(v_school,NULL,NULL,'criar',jsonb_set(v_data,'{trimestre}','3'));
   RAISE EXCEPTION 'inactive trimester accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   PERFORM public.provas_contexto(v_school,'20000000-0000-4000-8000-000000000002');
   RAISE EXCEPTION 'cross-school year accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 r:=public.provas_mutar(v_school,NULL,NULL,'criar',v_data||'{"classe":"falsificada","disciplina":"falsificada","ano_lectivo":"2000/2001"}'::jsonb);
 IF r.classe<>'8ª' OR r.disciplina<>'Física' OR r.ano_lectivo<>'2026/2027' THEN RAISE EXCEPTION 'untrusted snapshot accepted'; END IF;
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
 -- Direct RPC must reject rich payloads with arbitrary nodes, mismatched text or unsafe commands.
 BEGIN
   PERFORM provas_private.provas_rich_validate('{"version":1,"segments":[{"kind":"text","text":"x","marks":[]}]}','x');
   RAISE EXCEPTION 'direct validator execution allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   PERFORM public.provas_mutar(v_school,r.id,r.versao,'guardar',
     jsonb_set(jsonb_set(v_data,'{conteudo,0,texto}',to_jsonb(chr(92)||'href{https://evil.test}{x}')),
     '{conteudo,0,rich}',jsonb_build_object('version',1,'segments',jsonb_build_array(jsonb_build_object('kind','math','latex',chr(92)||'href{https://evil.test}{x}')))));
   RAISE EXCEPTION 'unsafe formula accepted';
 EXCEPTION WHEN invalid_parameter_value THEN
   IF SQLERRM <> 'unsupported_math_command' THEN RAISE; END IF;
 END;
 BEGIN
   PERFORM public.provas_mutar(v_school,r.id,r.versao,'guardar',jsonb_set(v_data,'{conteudo,0,rich}','{"version":1,"segments":[{"kind":"text","text":"different","marks":[]}]}'));
   RAISE EXCEPTION 'inconsistent rich accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
   PERFORM public.provas_mutar(v_school,r.id,r.versao,'guardar',jsonb_set(v_data,'{conteudo,0,rich}','{"version":1,"segments":[{"kind":"text","text":"Questão confidencial","marks":["bold"],"href":"https://evil.test"}]}'));
   RAISE EXCEPTION 'arbitrary attribute accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 v_data:=jsonb_set(v_data,'{conteudo,0,texto}',to_jsonb('Questão confidencial '||chr(92)||'frac{1}{2}'));
 v_data:=jsonb_set(v_data,'{conteudo,0,rich}',jsonb_build_object('version',1,'segments',jsonb_build_array(
  jsonb_build_object('kind','text','text','Questão confidencial ','marks',jsonb_build_array('bold')),
  jsonb_build_object('kind','math','latex',chr(92)||'frac{1}{2}')
 )));
 r:=public.provas_mutar(v_school,r.id,r.versao,'guardar',v_data);
 IF r.conteudo->0->'rich' IS DISTINCT FROM v_data->'conteudo'->0->'rich' THEN RAISE EXCEPTION 'rich persistence failed'; END IF;
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
