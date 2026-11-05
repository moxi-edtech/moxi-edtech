-- Run after balcao_academic_resolution_fixture.sql on a disposable DB.
-- Fixed UUIDs are synthetic. No customer data or remote connections.
BEGIN;
INSERT INTO auth.users VALUES ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002'),('10000000-0000-4000-8000-000000000003');
INSERT INTO public.escolas VALUES ('20000000-0000-4000-8000-000000000001'),('20000000-0000-4000-8000-000000000002');
INSERT INTO public.escola_users VALUES
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','diretor'),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','secretaria'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','diretor');
INSERT INTO public.anos_letivos VALUES ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',2026,true,'2026-01-01','2026-12-31');
INSERT INTO public.turmas VALUES ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',2026,'{"nivel_ensino":"eja","escala":"qualitativa","modulo_numero":1,"eh_classe_exame":false}');
INSERT INTO public.alunos VALUES('50000000-0000-4000-8000-000000000001');
INSERT INTO public.matriculas VALUES('60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','ativo',true,2026);
INSERT INTO public.disciplinas_catalogo(id,nome,escola_id) VALUES('70000000-0000-4000-8000-000000000001','Português','20000000-0000-4000-8000-000000000001');
INSERT INTO public.turma_disciplinas(id,escola_id,turma_id,avaliacao_disciplina_id) VALUES('80000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001');
INSERT INTO public.periodos_letivos VALUES('90000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','TRIMESTRE',1,'2026-01-01','2026-04-01');
INSERT INTO public.periodos_letivos VALUES('90000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','TRIMESTRE',2,'2026-05-01','2026-07-31'),('90000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','TRIMESTRE',3,'2026-08-01','2026-12-31');
INSERT INTO public.avaliacoes VALUES('91000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',1);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
DO $$
DECLARE r jsonb; r2 jsonb; id uuid; s uuid:='20000000-0000-4000-8000-000000000001'; m uuid:='60000000-0000-4000-8000-000000000001'; payload jsonb;
BEGIN
 IF has_function_privilege('anon','public.balcao_resolver_academico(uuid,uuid,text,jsonb,uuid)','execute') THEN RAISE EXCEPTION 'anon execute'; END IF;
 IF has_table_privilege('authenticated','public.raa_eja_avaliacoes_oficiais','INSERT') THEN RAISE EXCEPTION 'direct insert'; END IF;
 payload:='{"motivo":"Ata oficial confirmada pela direção","disciplina_id":"70000000-0000-4000-8000-000000000001","suficiente":true,"documento_fonte":"ATA-2026-01","expected_id":null}';
 r:=public.balcao_resolver_academico(s,m,'registar_eja',payload,'a0000000-0000-4000-8000-000000000001');
 r2:=public.balcao_resolver_academico(s,m,'registar_eja',payload,'a0000000-0000-4000-8000-000000000001');
 IF r->>'id' IS DISTINCT FROM r2->>'id' OR r2->>'idempotent'<>'true' THEN RAISE EXCEPTION 'retry duplicated'; END IF;
 BEGIN
   PERFORM public.balcao_resolver_academico(s,m,'registar_eja',payload||'{"suficiente":false}','a0000000-0000-4000-8000-000000000001');
   RAISE EXCEPTION 'key conflict accepted'; EXCEPTION WHEN unique_violation THEN NULL;
 END;
 BEGIN
   PERFORM public.balcao_resolver_academico(s,m,'registar_eja',payload,'a0000000-0000-4000-8000-000000000002');
   RAISE EXCEPTION 'stale version accepted'; EXCEPTION WHEN unique_violation THEN NULL;
 END;
 r2:=public.resolve_raa_eja_oficial(s,m);
 IF r2->>'decision'<>'pendente' THEN RAISE EXCEPTION 'missing attendance approved'; END IF;
 PERFORM public.balcao_resolver_academico(s,m,'reabrir_periodo','{"motivo":"Correção excecional autorizada na ata","disciplina_id":"70000000-0000-4000-8000-000000000001","periodo_id":"90000000-0000-4000-8000-000000000001"}','a0000000-0000-4000-8000-000000000003');
 IF NOT public.can_bypass_pauta_lock(s,'40000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001',auth.uid()) THEN RAISE EXCEPTION 'exception does not open'; END IF;
END; $$;
RESET ROLE;
INSERT INTO public.frequencia_status_periodo SELECT '20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',30,10,20,id FROM public.periodos_letivos;
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r:=public.resolve_raa_eja_oficial('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001');
 IF r->>'decision'<>'transitou' THEN RAISE EXCEPTION '2/3 boundary failed: %',r; END IF;
 r:=public.resolve_raa_decreto_for_matricula('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001');
 IF r->>'decision'<>'transitou' THEN RAISE EXCEPTION 'SQL consumer not integrated'; END IF;
 r:=public.resolve_estado_resultado('60000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001');
 IF r->>'suficiente'<>'true' THEN RAISE EXCEPTION 'canonical consumer lost qualitative evidence'; END IF;
END; $$;
RESET ROLE;
-- A real numeric exam session and a submitted result, with DB trigger installed.
UPDATE public.turmas SET regime='{"nivel_ensino":"secundario","escala":"quantitativa_secundario","classe_num":12,"eh_classe_exame":true}' WHERE id='40000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
DO $$
DECLARE s uuid:='20000000-0000-4000-8000-000000000001'; m uuid:='60000000-0000-4000-8000-000000000001'; r jsonb;
BEGIN
 BEGIN
  PERFORM public.balcao_resolver_academico(s,m,'abrir_exame','{"motivo":"Sessão autorizada para prova oficial","tipo":"recurso","modalidade":"simples","data_inicio":"2026-01-02","data_fim":"2026-01-03","componentes":[{"codigo":"escrita","peso":-1}]}',gen_random_uuid());
  RAISE EXCEPTION 'invalid weight accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
 r:=public.balcao_resolver_academico(s,m,'abrir_exame','{"motivo":"Sessão autorizada para prova oficial","tipo":"recurso","modalidade":"escrita_oral","data_inicio":"2026-01-02","data_fim":"2026-01-03","componentes":[{"codigo":"escrita","peso":1},{"codigo":"oral","peso":1}]}','a0000000-0000-4000-8000-000000000004');
 IF r->>'estado'<>'aberta' THEN RAISE EXCEPTION 'session not opened'; END IF;
END; $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.exame_sessoes)<>1 OR (SELECT count(*) FROM public.exame_componentes)<>2 THEN RAISE EXCEPTION 'exam transaction left orphans'; END IF;
END; $$;
INSERT INTO public.exame_resultados(escola_id,exame_sessao_id,exame_componente_id,matricula_id,aluno_id,turma_disciplina_id,nota,estado,lancado_por)
 SELECT '20000000-0000-4000-8000-000000000001',s.id,c.id,'60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',14,'submetido','10000000-0000-4000-8000-000000000001'
 FROM public.exame_sessoes s JOIN public.exame_componentes c ON c.exame_sessao_id=s.id WHERE c.codigo='escrita';
SELECT set_config('test.result_id',(SELECT id::text FROM public.exame_resultados LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r:=public.balcao_resolver_academico('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','validar_exame',jsonb_build_object('motivo','Resultado confirmado pela direção','resultado_id',current_setting('test.result_id')),'a0000000-0000-4000-8000-000000000005');
 IF r->>'estado'<>'validado' THEN RAISE EXCEPTION 'exam not validated'; END IF;
END; $$;
-- Publication claims: one writer, retry, immutable path and prior PDF preservation.
RESET ROLE;
INSERT INTO public.pautas_oficiais(id,escola_id,turma_id,periodo_letivo_id,tipo,status,pdf_path,hash)
 VALUES('92000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','anual','SUCCESS','old-official.pdf','original');
SET LOCAL ROLE authenticated;
DO $$
DECLARE r jsonb; again jsonb; recovered jsonb; finished jsonb; payload jsonb:='{"motivo":"Publicação revista pela direção académica","periodo_id":"90000000-0000-4000-8000-000000000001","tipo":"anual"}';
 s uuid:='20000000-0000-4000-8000-000000000001'; m uuid:='60000000-0000-4000-8000-000000000001'; k uuid:='a0000000-0000-4000-8000-000000000006';
BEGIN
 r:=public.balcao_resolver_academico(s,m,'preparar_publicacao',payload,k);
 IF r->>'pdf_path'='old-official.pdf' THEN RAISE EXCEPTION 'would overwrite original'; END IF;
 again:=public.balcao_resolver_academico(s,m,'preparar_publicacao',payload,k);
 IF again->>'busy'<>'true' THEN RAISE EXCEPTION 'concurrent same key not busy'; END IF;
 BEGIN
   PERFORM public.balcao_resolver_academico(s,m,'preparar_publicacao',payload,gen_random_uuid());
   RAISE EXCEPTION 'second publication writer accepted'; EXCEPTION WHEN unique_violation THEN NULL;
 END;
 PERFORM public.balcao_concluir_publicacao(s,m,k,(r->>'token')::uuid,false);
 recovered:=public.balcao_resolver_academico(s,m,'preparar_publicacao',payload,k);
 IF recovered->>'token'=r->>'token' OR recovered->>'pdf_path'=r->>'pdf_path' THEN RAISE EXCEPTION 'retry did not rotate ownership'; END IF;
 BEGIN
   PERFORM public.balcao_concluir_publicacao(s,m,k,(r->>'token')::uuid,true);
   RAISE EXCEPTION 'stale publication completed'; EXCEPTION WHEN check_violation THEN NULL;
 END;
 BEGIN
   PERFORM public.balcao_concluir_publicacao(s,m,k,(recovered->>'token')::uuid,true);
   RAISE EXCEPTION 'publication succeeded without uploaded file'; EXCEPTION WHEN check_violation THEN NULL;
 END;
 -- Provider fixture: emulate the Storage object created after a successful PDF upload.
 PERFORM set_config('test.upload_path',recovered->>'pdf_path',true);
 EXECUTE 'RESET ROLE';
 INSERT INTO storage.objects VALUES('pautas_oficiais_fechadas',current_setting('test.upload_path'),'{"size":1000,"mimetype":"application/pdf"}');
 EXECUTE 'SET LOCAL ROLE authenticated';
 finished:=public.balcao_concluir_publicacao(s,m,k,(recovered->>'token')::uuid,true);
 IF finished->>'status'<>'SUCCESS' THEN RAISE EXCEPTION 'publication did not complete'; END IF;
 -- A lost final HTTP response must not turn a successful publication into FAILED.
 finished:=public.balcao_concluir_publicacao(s,m,k,(recovered->>'token')::uuid,false);
 IF finished->>'status'<>'SUCCESS' THEN RAISE EXCEPTION 'late failure reverted publication'; END IF;
END; $$;
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.audit_logs WHERE action='BALCAO_PAUTA_VERSION_RESERVED' AND details->'previous'->>'pdf_path'='old-official.pdf') THEN RAISE EXCEPTION 'previous publication not retained'; END IF;
END; $$;
SET LOCAL ROLE authenticated;

RESET ROLE;
UPDATE public.excecoes_pauta SET expira_em=now()-interval '1 second';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF public.can_bypass_pauta_lock('20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001',auth.uid()) THEN RAISE EXCEPTION 'expired exception accepted'; END IF;
END; $$;
RESET ROLE;
UPDATE public.matriculas SET status='concluido',ativo=false;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM public.balcao_resolver_academico('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','reabrir_periodo','{"motivo":"Correção excecional autorizada na ata","disciplina_id":"70000000-0000-4000-8000-000000000001","periodo_id":"90000000-0000-4000-8000-000000000001"}',gen_random_uuid());
  RAISE EXCEPTION 'legal closure ignored'; EXCEPTION WHEN check_violation THEN NULL;
 END;
END; $$;

-- Secretary and foreign director cannot execute exceptional decisions or read evidence.
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.raa_eja_avaliacoes_oficiais) THEN RAISE EXCEPTION 'secretary evidence leak'; END IF;
 BEGIN
  PERFORM public.balcao_resolver_academico('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','registar_eja','{"motivo":"Solicitação sem permissão suficiente"}',gen_random_uuid());
  RAISE EXCEPTION 'secretary allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END; $$;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.raa_eja_avaliacoes_oficiais) THEN RAISE EXCEPTION 'cross tenant leak'; END IF;
 BEGIN
  PERFORM public.resolve_raa_eja_oficial('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'foreign resolve allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END; $$;
RESET ROLE;
-- Verify failed operations left no evidence, and successful calls are audited once.
DO $$ BEGIN
 IF (SELECT count(*) FROM public.raa_eja_avaliacoes_oficiais)<>1 THEN RAISE EXCEPTION 'evidence duplicated'; END IF;
 IF (SELECT count(*) FROM public.audit_logs WHERE action NOT LIKE 'BALCAO_PAUTA_%' AND action<>'BALCAO_ACADEMIC_PREPARAR_PUBLICACAO')<>4 THEN RAISE EXCEPTION 'audit not atomic'; END IF;
END; $$;
ROLLBACK;
\echo BALCAO_ACADEMIC_REGRESSION_PASS
