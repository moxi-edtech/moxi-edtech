\set ON_ERROR_STOP on
BEGIN;
-- Exercise the real SQL resolver adapter with synthetic canonical regimes.
DO $scale_test$
DECLARE sch uuid:='00000000-0000-4000-8000-000000000001'; yr uuid:='20000000-0000-4000-8000-000000000001'; mx uuid:='70000000-0000-4000-8000-000000000001';
BEGIN
 IF provas_private.provas_cotacao_max(sch,yr,mx,1) IS DISTINCT FROM 2000 THEN RAISE EXCEPTION 'secondary scale'; END IF;
 UPDATE public.turmas SET fixture_escala='quantitativa_primario';
 IF provas_private.provas_cotacao_max(sch,yr,mx,1) IS DISTINCT FROM 1000 THEN RAISE EXCEPTION 'primary scale'; END IF;
 UPDATE public.turmas SET fixture_escala='quantitativa_secundario' WHERE id='80000000-0000-4000-8000-000000000002';
 IF provas_private.provas_cotacao_max(sch,yr,mx,1) IS NOT NULL THEN RAISE EXCEPTION 'mixed scale accepted'; END IF;
 UPDATE public.turmas SET fixture_escala='qualitativa';
 IF provas_private.provas_cotacao_max(sch,yr,mx,1) IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'qualitative scale'; END IF;
 UPDATE public.turmas SET fixture_escala=NULL WHERE id='80000000-0000-4000-8000-000000000002';
 IF provas_private.provas_cotacao_max(sch,yr,mx,1) IS NOT NULL THEN RAISE EXCEPTION 'unknown scale accepted'; END IF;
 IF provas_private.provas_cotacao_max('00000000-0000-4000-8000-000000000002',yr,mx,1) IS NOT NULL THEN RAISE EXCEPTION 'cross tenant scale accepted'; END IF;
 UPDATE public.turmas SET fixture_escala='quantitativa_secundario';
END;
$scale_test$;

DO $grids$
DECLARE v text;
BEGIN
 FOREACH v IN ARRAY ARRAY[$tex$\begin{cases}2x+y=10\\x-y=2\end{cases}$tex$,$tex$\begin{pmatrix}2&3\\4&5\end{pmatrix}$tex$,$tex$\begin{vmatrix}\frac{1}{2}&x\\3&4\end{vmatrix}$tex$,$tex$\frac{dy}{dx}=3x^{2}$tex$] LOOP
  IF provas_private.provas_rich_validate(jsonb_build_object('version',1,'segments',jsonb_build_array(jsonb_build_object('kind','math','latex',v))),v)<>1 THEN RAISE EXCEPTION 'valid grid rejected'; END IF;
 END LOOP;
 FOREACH v IN ARRAY ARRAY[$tex$\begin{array}1&2\end{array}$tex$,$tex$\begin{pmatrix}1&2\\3\end{pmatrix}$tex$,$tex$\begin{vmatrix}1&2&3\\4&5&6\end{vmatrix}$tex$,$tex$\begin{cases}x=1\end{cases}$tex$,$tex$\begin{pmatrix}1&\htmlClass{a}{x}\\3&4\end{pmatrix}$tex$,$tex$\begin{pmatrix}1&2\\3&4\end{vmatrix}$tex$,$tex$x&y$tex$,$tex$\begin{pmatrix}1&2\\3&\begin{pmatrix}4\end{pmatrix}\end{pmatrix}$tex$,$tex$\begin{pmatrix}1&&2\\3&4&5\end{pmatrix}$tex$,$tex$\begin{pmatrix}1&2&3&4&5\end{pmatrix}$tex$] LOOP
  BEGIN
   PERFORM provas_private.provas_rich_validate(jsonb_build_object('version',1,'segments',jsonb_build_array(jsonb_build_object('kind','math','latex',v))),v);
   RAISE EXCEPTION 'invalid grid accepted: %',v;
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
 END LOOP;
END;
$grids$;
DO $answer_format$
DECLARE b jsonb:='{"tipo":"alinea","texto":"Mostra os cálculos.","linhas":6,"resposta_formato":"retangulo"}'; bad jsonb;
BEGIN
 PERFORM provas_private.provas_validar_blocos(jsonb_build_array(b));
 PERFORM provas_private.provas_validar_blocos('[{"tipo":"calculo","texto":"Q","linhas":3,"resposta_formato":"linhas"}]'::jsonb);
 PERFORM provas_private.provas_validar_blocos('[{"tipo":"calculo","texto":"Q","linhas":0,"resposta_formato":"nenhum"}]'::jsonb);
 FOR bad IN SELECT value FROM jsonb_array_elements('[{"resposta_formato":"other"},{"linhas":0},{"linhas":2},{"resposta_formato":"nenhum"},{"tipo":"grupo"},{"resposta_formato":null}]'::jsonb) LOOP
  BEGIN
   PERFORM provas_private.provas_validar_blocos(jsonb_build_array(b||bad));
   RAISE EXCEPTION 'invalid answer format accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 END LOOP;
END;
$answer_format$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
DO $$
DECLARE r public.provas_pedagogicas; attempt public.provas_pedagogicas; v_bad jsonb; wrong_cent integer;
 v_school uuid:='00000000-0000-4000-8000-000000000001';
 v_data jsonb:='{"ano_letivo_id":"20000000-0000-4000-8000-000000000001","curso_matriz_id":"70000000-0000-4000-8000-000000000001","tipo_prova":"recurso","titulo":"Prova","classe":"8ª","disciplina":"Física","ano_lectivo":"2026/2027","trimestre":1,"duracao":90,"serie":"A","conteudo":[{"tipo":"discursiva","texto":"Questão confidencial","linhas":3}]}';
BEGIN
 IF jsonb_array_length(public.provas_contexto(v_school,'20000000-0000-4000-8000-000000000001'))<>2 THEN RAISE EXCEPTION 'teacher context leaked or missing'; END IF;
 IF (public.provas_contexto(v_school,'20000000-0000-4000-8000-000000000001')->0->>'cotacao_max_cent')::integer IS DISTINCT FROM 2000 THEN RAISE EXCEPTION 'scale unavailable'; END IF;
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
 IF r.apresentacao<>'automatica' THEN RAISE EXCEPTION 'default presentation failed'; END IF;
 IF r.tipo_prova<>'recurso' OR r.estado<>'rascunho' OR r.versao<>1 OR r.autor_id<>auth.uid() THEN RAISE EXCEPTION 'create failed'; END IF;
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
 -- Structured choices and marks remain protected against direct RPC bypass.
 FOR v_bad IN SELECT value FROM jsonb_array_elements('[{"tipo":"escolha","texto":"Q","linhas":0,"alternativas":[""]},{"tipo":"discursiva","texto":"Q","linhas":2,"alternativas":["A","B"]},{"tipo":"escolha","texto":"Q","linhas":0,"alternativas":["A",null]},{"tipo":"discursiva","texto":"Q","linhas":2,"cotacao_cent":2001},{"tipo":"discursiva","texto":"Q","linhas":2,"cotacao_cent":1.5},{"tipo":"grupo","texto":"G","linhas":0,"cotacao_cent":1}]'::jsonb) LOOP
  BEGIN
   PERFORM public.provas_mutar(v_school,r.id,r.versao,'guardar',jsonb_set(v_data,'{conteudo}',jsonb_build_array(v_bad)));
   RAISE EXCEPTION 'invalid structured question accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 END LOOP;
 v_data:=jsonb_set(v_data,'{conteudo}',(v_data->'conteudo')||'[{"tipo":"escolha","texto":"Qual?","linhas":0,"alternativas":["Joule","Watt"],"cotacao_cent":125}]'::jsonb);
 BEGIN
   PERFORM public.provas_mutar(v_school,r.id,r.versao,'guardar',v_data||'{"apresentacao":"invalid"}'::jsonb);
   RAISE EXCEPTION 'invalid presentation accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
   PERFORM public.provas_mutar(v_school,r.id,r.versao,'guardar',v_data||'{"apresentacao":null}'::jsonb);
   RAISE EXCEPTION 'null presentation accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 v_data:=v_data||'{"apresentacao":"espacosa"}'::jsonb;
 BEGIN
   PERFORM public.provas_mutar(v_school,r.id,r.versao,'submeter',NULL);
   RAISE EXCEPTION 'missing cotacao accepted';
 EXCEPTION WHEN invalid_parameter_value THEN
   IF SQLERRM<>'invalid_exam_cotacao' THEN RAISE; END IF;
 END;
 FOREACH wrong_cent IN ARRAY ARRAY[1000,1900] LOOP
  BEGIN
   attempt:=public.provas_mutar(v_school,r.id,r.versao,'guardar',jsonb_set(v_data,'{conteudo,0,cotacao_cent}',to_jsonb(wrong_cent)));
   PERFORM public.provas_mutar(v_school,attempt.id,attempt.versao,'submeter',NULL);
   RAISE EXCEPTION 'incorrect total accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
   IF SQLERRM<>'invalid_exam_cotacao' THEN RAISE; END IF;
  END;
 END LOOP;
 v_data:=jsonb_set(v_data,'{conteudo,0,cotacao_cent}','1875');
 r:=public.provas_mutar(v_school,r.id,r.versao,'guardar',v_data);
 IF r.apresentacao<>'espacosa' THEN RAISE EXCEPTION 'presentation persistence failed'; END IF;
 IF r.conteudo->1 IS DISTINCT FROM v_data->'conteudo'->1 THEN RAISE EXCEPTION 'structured question persistence failed'; END IF;
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
-- Nominal distribution never exposes a draft even to administration.
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
DO $test$
BEGIN
 BEGIN
  PERFORM public.provas_destinatarios('00000000-0000-4000-8000-000000000001',current_setting('test.prova_id')::uuid,2,'turmas',ARRAY[]::uuid[],NULL,0);
  RAISE EXCEPTION 'draft distribution allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$test$;
-- Other teacher, student, secretary and other-school admin cannot read draft.
DO $$
DECLARE u text;
BEGIN
 FOREACH u IN ARRAY ARRAY['10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000008'] LOOP
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
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000007',true);
DO $$
DECLARE r public.provas_pedagogicas;
BEGIN
 IF (SELECT count(*) FROM public.provas_pedagogicas)<>1 THEN RAISE EXCEPTION 'financial admin cannot read review queue'; END IF;
 IF jsonb_array_length(public.provas_contexto('00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001'))<>3 THEN RAISE EXCEPTION 'financial admin context missing'; END IF;
 r:=public.provas_mutar('00000000-0000-4000-8000-000000000001',current_setting('test.prova_id')::uuid,3,'aprovar',NULL);
 IF r.apresentacao<>'espacosa' THEN RAISE EXCEPTION 'approved presentation changed'; END IF;
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
DO $test$
DECLARE sch uuid:='00000000-0000-4000-8000-000000000001'; p uuid:=current_setting('test.prova_id')::uuid; turma uuid:='80000000-0000-4000-8000-000000000001'; turma_b uuid:='80000000-0000-4000-8000-000000000002'; m uuid:='b0000000-0000-4000-8000-000000000001'; x jsonb; y jsonb;
BEGIN
 x:=public.provas_destinatarios(sch,p,4,'turmas',ARRAY[]::uuid[],NULL,0);
 IF jsonb_array_length(x->'items')<>2 OR (x->>'total')::int<>43 THEN RAISE EXCEPTION 'campus scope or active counts incorrect: %',x; END IF;
 x:=public.provas_destinatarios(sch,p,4,'alunos',ARRAY[turma],NULL,0);
 IF (x->>'total')::int<>42 OR jsonb_array_length(x->'items')<>42 THEN RAISE EXCEPTION 'invalid roster'; END IF;
 x:=public.provas_destinatarios(sch,p,4,'imprimir',ARRAY[turma],NULL,0);
 y:=public.provas_destinatarios(sch,p,4,'imprimir',ARRAY[turma],NULL,40);
 IF jsonb_array_length(x->'items')<>40 OR jsonb_array_length(y->'items')<>2 OR x->>'snapshot' IS DISTINCT FROM y->>'snapshot' THEN RAISE EXCEPTION 'batch continuity failed'; END IF;
 x:=public.provas_destinatarios(sch,p,4,'imprimir',ARRAY[turma,turma_b],NULL,40);
 IF (x->>'total')::int<>43 OR jsonb_array_length(x->'items')<>3 THEN RAISE EXCEPTION 'multi class print failed'; END IF;
 x:=public.provas_destinatarios(sch,p,4,'imprimir',ARRAY[turma],m,0);
 IF (x->>'total')::int<>1 OR x->'items'->0->>'nome'<>'Aluno Completo 1' OR x->'items'->0->>'sala'<>'12' OR x->'items'->0->>'letra'<>'A' OR x->'items'->0->>'curso'<>'Ensino Geral' OR x->'items'->0->>'turno'<>'M' OR x->'items'->0 ? 'aluno_id' THEN RAISE EXCEPTION 'individual context failed'; END IF;
 BEGIN
  PERFORM public.provas_destinatarios(sch,p,4,'imprimir',ARRAY[turma_b],m,0);
  RAISE EXCEPTION 'foreign class enrollment accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
  PERFORM public.provas_destinatarios(sch,p,4,'imprimir',ARRAY['80000000-0000-4000-8000-000000000003'::uuid],NULL,0);
  RAISE EXCEPTION 'campus restricted turma accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.provas_destinatarios(sch,p,3,'imprimir',ARRAY[turma],NULL,0);
  RAISE EXCEPTION 'old version accepted';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
 BEGIN
  PERFORM public.provas_destinatarios(sch,p,4,'imprimir',ARRAY[turma],NULL,0);
  RAISE EXCEPTION 'teacher nominal distribution accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000006',true);
 BEGIN
  PERFORM public.provas_destinatarios(sch,p,4,'turmas',ARRAY[]::uuid[],NULL,0);
  RAISE EXCEPTION 'cross tenant distribution accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$test$;
DO $$
DECLARE u text;
BEGIN
 FOREACH u IN ARRAY ARRAY['10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000006'] LOOP
   PERFORM set_config('request.jwt.claim.sub',u,true);
   IF EXISTS(SELECT 1 FROM public.provas_pedagogicas) THEN RAISE EXCEPTION 'approved leak to %',u; END IF;
 END LOOP;
END $$;
DO $print_roles$
DECLARE u text; school uuid:='00000000-0000-4000-8000-000000000001'; p uuid:=current_setting('test.prova_id')::uuid;
BEGIN
 FOREACH u IN ARRAY ARRAY['10000000-0000-4000-8000-000000000008'] LOOP
  PERFORM set_config('request.jwt.claim.sub',u,true);
  IF (SELECT count(*) FROM public.provas_pedagogicas)<>1 THEN RAISE EXCEPTION 'approved proof unavailable to print role'; END IF;
  IF (public.provas_destinatarios(school,p,4,'turmas',ARRAY[]::uuid[],NULL,0)->>'total')::int<>43 THEN RAISE EXCEPTION 'print role missing distribution'; END IF;
  BEGIN
   PERFORM public.provas_mutar(school,p,4,'arquivar',NULL);
   RAISE EXCEPTION 'print role can mutate approved proof';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 END LOOP;
END;
$print_roles$;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000007',true);
DO $financial_admin$
DECLARE r public.provas_pedagogicas; copy public.provas_pedagogicas; sch uuid:='00000000-0000-4000-8000-000000000001'; p uuid:=current_setting('test.prova_id')::uuid; data jsonb;
BEGIN
 SELECT * INTO r FROM public.provas_pedagogicas WHERE id=p;
 IF (public.provas_destinatarios(sch,p,4,'turmas',ARRAY[]::uuid[],NULL,0)->>'total')::int<>43 THEN RAISE EXCEPTION 'financial admin distribution missing'; END IF;
 copy:=public.provas_mutar(sch,p,4,'duplicar',NULL);
 IF copy.estado<>'rascunho' THEN RAISE EXCEPTION 'financial admin cannot duplicate'; END IF;
 data:=to_jsonb(copy)-ARRAY['id','escola_id','autor_id','estado','versao','criado_em','atualizado_em','aprovado_por','aprovado_em'];
 copy:=public.provas_mutar(sch,copy.id,copy.versao,'guardar',data);
 copy:=public.provas_mutar(sch,copy.id,copy.versao,'submeter',NULL);
 copy:=public.provas_mutar(sch,copy.id,copy.versao,'devolver',NULL);
 copy:=public.provas_mutar(sch,copy.id,copy.versao,'arquivar',NULL);
 IF copy.estado<>'arquivada' THEN RAISE EXCEPTION 'financial admin lifecycle failed'; END IF;
 -- Direct administrative publication is versioned, validates marks and preserves local schedule.
 copy:=public.provas_mutar(sch,p,4,'duplicar',NULL);
 IF copy.data_realizacao IS NOT NULL OR copy.hora_inicio IS NOT NULL THEN RAISE EXCEPTION 'duplicate inherited schedule'; END IF;
 data:=(to_jsonb(copy)-ARRAY['id','escola_id','autor_id','estado','versao','criado_em','atualizado_em','aprovado_por','aprovado_em'])||'{"data_realizacao":"2026-12-07","hora_inicio":"08:30"}'::jsonb;
 copy:=public.provas_mutar(sch,copy.id,copy.versao,'guardar',data);
 IF copy.data_realizacao IS DISTINCT FROM DATE '2026-12-07' OR copy.hora_inicio IS DISTINCT FROM TIME '08:30' THEN RAISE EXCEPTION 'schedule not persisted'; END IF;
 BEGIN
   PERFORM public.provas_mutar(sch,copy.id,copy.versao,'guardar',data||'{"data_realizacao":null}'::jsonb);
   RAISE EXCEPTION 'hour without date accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 copy:=public.provas_mutar(sch,copy.id,copy.versao,'aprovar',NULL);
 IF copy.estado<>'aprovada' OR copy.aprovado_por IS DISTINCT FROM auth.uid() OR copy.data_realizacao IS DISTINCT FROM DATE '2026-12-07' THEN RAISE EXCEPTION 'direct publication failed'; END IF;
 -- Link to the existing calendar without copying the questions.
 IF NOT EXISTS(SELECT 1 FROM public.provas_por_professor(sch,'90000000-0000-4000-8000-000000000001') x WHERE x.id=copy.id) THEN RAISE EXCEPTION 'assigned professor filter missed proof'; END IF;
 IF EXISTS(SELECT 1 FROM public.provas_por_professor(sch,'90000000-0000-4000-8000-000000000099')) THEN RAISE EXCEPTION 'unknown professor returned proofs'; END IF;
 IF NOT ('aprovada'=ANY(public.provas_faceta(sch,'estado',jsonb_build_object('classe',copy.classe,'estado','rascunho'),false))) THEN RAISE EXCEPTION 'facet must ignore its own filter'; END IF;
 IF cardinality(public.provas_faceta(sch,'disciplina','{"classe":"Classe inexistente"}'::jsonb,false))<>0 THEN RAISE EXCEPTION 'incompatible discipline exposed'; END IF;
 IF NOT ('90000000-0000-4000-8000-000000000001'=ANY(public.provas_faceta(sch,'professor',jsonb_build_object('classe',copy.classe,'estado','aprovada'),false))) THEN RAISE EXCEPTION 'assigned professor facet missing'; END IF;
 IF cardinality(public.provas_faceta('00000000-0000-4000-8000-000000000002','classe','{}'::jsonb,false))<>0 THEN RAISE EXCEPTION 'cross-tenant facet exposed'; END IF;
 INSERT INTO public.calendario_avaliacoes(escola_id,ano_letivo_id,periodo_letivo_id,turma_id,turma_disciplina_id,estado,data,inicio,fim,prova_id)
 SELECT sch,copy.ano_letivo_id,pl.id,td.turma_id,td.id,'publicado','2026-12-07','08:30','10:00',copy.id
 FROM public.periodos_letivos pl CROSS JOIN public.turma_disciplinas td WHERE pl.escola_id=sch AND pl.ano_letivo_id=copy.ano_letivo_id AND pl.numero=copy.trimestre AND td.escola_id=sch AND td.curso_matriz_id=copy.curso_matriz_id AND td.turma_id='80000000-0000-4000-8000-000000000001';
 IF NOT EXISTS(SELECT 1 FROM public.calendario_avaliacoes WHERE prova_id=copy.id AND estado='publicado') THEN RAISE EXCEPTION 'calendar link missing'; END IF;
 BEGIN
  INSERT INTO public.calendario_avaliacoes(escola_id,ano_letivo_id,periodo_letivo_id,turma_id,turma_disciplina_id,estado,data,inicio,fim,prova_id)
  SELECT ca.escola_id,ca.ano_letivo_id,ca.periodo_letivo_id,ca.turma_id,ca.turma_disciplina_id,ca.estado,ca.data,ca.inicio,ca.fim,ca.prova_id FROM public.calendario_avaliacoes ca WHERE ca.prova_id=copy.id;
  RAISE EXCEPTION 'duplicate class schedule accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  UPDATE public.calendario_avaliacoes SET prova_id=NULL WHERE prova_id=copy.id;
  RAISE EXCEPTION 'link was mutable';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  INSERT INTO public.calendario_avaliacoes(escola_id,ano_letivo_id,periodo_letivo_id,turma_id,turma_disciplina_id,estado,data,inicio,fim,prova_id)
  SELECT '00000000-0000-4000-8000-000000000002',ca.ano_letivo_id,ca.periodo_letivo_id,ca.turma_id,ca.turma_disciplina_id,ca.estado,ca.data,ca.inicio,ca.fim,ca.prova_id FROM public.calendario_avaliacoes ca WHERE ca.prova_id=copy.id;
  RAISE EXCEPTION 'cross tenant calendar link accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
 IF EXISTS(SELECT 1 FROM public.provas_por_professor(sch,'90000000-0000-4000-8000-000000000001')) THEN RAISE EXCEPTION 'teacher could use admin filter'; END IF;
 BEGIN
  INSERT INTO public.calendario_avaliacoes(escola_id,ano_letivo_id,periodo_letivo_id,turma_id,turma_disciplina_id,estado,data,inicio,fim,prova_id)
  SELECT ca.escola_id,ca.ano_letivo_id,ca.periodo_letivo_id,ca.turma_id,ca.turma_disciplina_id,ca.estado,ca.data,ca.inicio,ca.fim,ca.prova_id FROM public.calendario_avaliacoes ca WHERE ca.prova_id=copy.id;
  RAISE EXCEPTION 'teacher linked calendar event';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000007',true);
 BEGIN
   PERFORM public.provas_mutar(sch,copy.id,copy.versao-1,'aprovar',NULL);
   RAISE EXCEPTION 'stale direct publication accepted';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN
  PERFORM public.provas_mutar('00000000-0000-4000-8000-000000000002',NULL,NULL,'criar',data);
  RAISE EXCEPTION 'financial admin cross tenant write allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$financial_admin$;
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
