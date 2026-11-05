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
UPDATE public.periodos_letivos SET data_fim='2026-10-31' WHERE numero=3;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
DO $$
DECLARE school uuid:='20000000-0000-4000-8000-000000000001'; source uuid:='60000000-0000-4000-8000-000000000001'; item jsonb; payload jsonb; r jsonb; key uuid; count_before int;
BEGIN
 PERFORM public.balcao_resolver_academico(school,source,'registar_eja','{"motivo":"Avaliação conferida no documento oficial EJA","disciplina_id":"70000000-0000-4000-8000-000000000001","suficiente":true,"documento_fonte":"ATA-EJA-2026","expected_id":null}',gen_random_uuid());
 IF public.resolve_raa_eja_oficial(school,source)->>'decision'<>'pendente' THEN RAISE EXCEPTION 'missing attendance must remain pending'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(public.balcao_eja_frequencias(school,source)) LOOP
  payload:=jsonb_build_object('motivo','Frequência conferida no registo oficial','periodo_id',item->>'periodo_id','aulas_previstas',30,'presencas',30,'documento_fonte','REGISTO-EJA-2026','expected_version',item->>'version');
  key:=gen_random_uuid();
  r:=public.balcao_resolver_academico(school,source,'registar_frequencia_eja',payload,key);
  IF r->'frequency_after'->>'evidence_id' IS NULL THEN RAISE EXCEPTION 'attendance evidence not stored'; END IF;
  r:=public.balcao_resolver_academico(school,source,'registar_frequencia_eja',payload,key);
  IF r->>'idempotent'<>'true' THEN RAISE EXCEPTION 'retry not idempotent'; END IF;
  BEGIN
   PERFORM public.balcao_resolver_academico(school,source,'registar_frequencia_eja',payload,gen_random_uuid());
   RAISE EXCEPTION 'stale correction accepted'; EXCEPTION WHEN unique_violation THEN
    IF SQLERRM<>'EJA_VERSION_CONFLICT' THEN RAISE; END IF;
  END;
 END LOOP;
 IF public.resolve_raa_eja_oficial(school,source)->>'decision'<>'transitou' THEN RAISE EXCEPTION 'complete official frequency did not release EJA'; END IF;
 -- Lower the first period to documented zero: 60/90 is still sufficient.
 -- Lower the second too: 30/90 must re-block. No automatic approval/fabrication.
 FOR item IN SELECT value FROM jsonb_array_elements(public.balcao_eja_frequencias(school,source)) WHERE (value->>'numero')::int<=2 LOOP
  payload:=jsonb_build_object('motivo','Retificação documentada de frequência oficial','periodo_id',item->>'periodo_id','aulas_previstas',30,'presencas',0,'documento_fonte','REGISTO-RETIFICADO','expected_version',item->>'version');
  PERFORM public.balcao_resolver_academico(school,source,'registar_frequencia_eja',payload,gen_random_uuid());
 END LOOP;
 IF public.resolve_raa_eja_oficial(school,source)->>'decision'<>'retido_por_faltas' THEN RAISE EXCEPTION 'insufficient documented frequency auto-approved'; END IF;
 SELECT value INTO item FROM jsonb_array_elements(public.balcao_eja_frequencias(school,source)) LIMIT 1;
 payload:=jsonb_build_object('motivo','Presenças impossíveis devem ser recusadas','periodo_id',item->>'periodo_id','aulas_previstas',30,'presencas',31,'documento_fonte','REGISTO-INVALIDO','expected_version',item->>'version');
 BEGIN
  PERFORM public.balcao_resolver_academico(school,source,'registar_frequencia_eja',payload,gen_random_uuid());
  RAISE EXCEPTION 'impossible attendance accepted'; EXCEPTION WHEN check_violation THEN NULL;
 END;
 BEGIN UPDATE public.raa_eja_frequencias_oficiais SET presencas=30;
  RAISE EXCEPTION 'evidence mutable by staff'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.raa_eja_frequencias_oficiais)<>5 THEN RAISE EXCEPTION 'evidence history lost or retry duplicated'; END IF;
 IF EXISTS(SELECT 1 FROM public.frequencia_status_periodo) THEN RAISE EXCEPTION 'original summaries were overwritten'; END IF;
 IF (SELECT count(*) FROM public.audit_logs WHERE action='BALCAO_ACADEMIC_REGISTAR_FREQUENCIA_EJA' AND actor_id='10000000-0000-4000-8000-000000000002')<>5 THEN RAISE EXCEPTION 'frequency decisions not audited'; END IF;
END $$;
-- Deliberately fail the audit to prove that the frequency evidence rolls back.
CREATE FUNCTION public.fixture_guided_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture guided audit failure'; END $$;
CREATE TRIGGER fixture_guided_audit_failure BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.fixture_guided_audit_failure();
SET LOCAL ROLE authenticated;
DO $$ DECLARE item jsonb; BEGIN
 SELECT value INTO item FROM jsonb_array_elements(public.balcao_eja_frequencias('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001')) LIMIT 1;
 BEGIN
  PERFORM public.balcao_resolver_academico('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','registar_frequencia_eja',
   jsonb_build_object('motivo','Conferência deve recuar quando a auditoria falha','periodo_id',item->>'periodo_id','aulas_previstas',30,'presencas',29,'documento_fonte','REGISTO-AUDITORIA','expected_version',item->>'version'),gen_random_uuid());
  RAISE EXCEPTION 'mutation survived without audit'; EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'fixture guided audit failure' THEN RAISE; END IF;
 END;
END $$;
RESET ROLE;
DO $$ BEGIN IF (SELECT count(*) FROM public.raa_eja_frequencias_oficiais)<>5 THEN RAISE EXCEPTION 'unaudited evidence persisted'; END IF; END $$;
DROP TRIGGER fixture_guided_audit_failure ON public.audit_logs;
-- A school-linked student cannot query another enrolment through the helper.
UPDATE public.escola_users SET papel='aluno' WHERE user_id='10000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM public.balcao_eja_frequencias('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'student school membership bypassed attendance permission'; EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
RESET ROLE;
UPDATE public.escola_users SET papel='secretaria' WHERE user_id='10000000-0000-4000-8000-000000000002';
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.sub','',true);
DO $$ BEGIN
 IF public.resolve_raa_eja_oficial('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001')->>'decision'<>'retido_por_faltas' THEN RAISE EXCEPTION 'service canonical resolver regressed'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
-- Time and tenant boundaries remain enforced even in the exceptional flow.
UPDATE public.periodos_letivos SET data_fim=current_date+1 WHERE numero=3;
SET LOCAL ROLE authenticated;
DO $$ DECLARE item jsonb; BEGIN
 SELECT value INTO item FROM jsonb_array_elements(public.balcao_eja_frequencias('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001')) WHERE value->>'numero'='3';
 BEGIN
  PERFORM public.balcao_resolver_academico('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','registar_frequencia_eja',
    jsonb_build_object('motivo','Um período futuro não representa frequência completa','periodo_id',item->>'periodo_id','aulas_previstas',30,'presencas',30,'documento_fonte','REGISTO-FUTURO','expected_version',item->>'version'),gen_random_uuid());
  RAISE EXCEPTION 'future term accepted'; EXCEPTION WHEN check_violation THEN
    IF SQLERRM<>'EJA_ATTENDANCE_PERIOD_NOT_FINISHED' THEN RAISE; END IF;
 END;
END $$;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.raa_eja_frequencias_oficiais) THEN RAISE EXCEPTION 'foreign frequency evidence leaked'; END IF;
 BEGIN
  PERFORM public.balcao_exam_progress('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'foreign exam context leaked'; EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
ROLLBACK;
\echo BALCAO_GUIDED_FREQUENCY_AUDIT_PASS
