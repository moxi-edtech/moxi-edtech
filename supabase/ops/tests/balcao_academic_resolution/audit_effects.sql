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

UPDATE public.turmas SET regime='{"nivel_ensino":"secundario","classe_num":8,"escala":"quantitativa_secundario","eh_classe_exame":false,"exames_aplicaveis":["extraordinario"]}';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
DO $$
DECLARE r jsonb; source uuid:='60000000-0000-4000-8000-000000000001'; school uuid:='20000000-0000-4000-8000-000000000001';
BEGIN
 r:=public.resolve_raa_decreto_for_matricula(school,source);
 IF r->>'decision'<>'inscricao_condicional' OR (r->>'efetivacao_matricula_bloqueada')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'initial source must be blocked'; END IF;
 r:=public.balcao_resolver_academico(school,source,'reabrir_periodo','{"motivo":"Correção documentada pela secretaria","periodo_id":"90000000-0000-4000-8000-000000000001","disciplina_id":"70000000-0000-4000-8000-000000000001"}',gen_random_uuid());
 IF r->'academic_after'->>'decision'<>'inscricao_condicional' THEN RAISE EXCEPTION 'exception itself changed the grade'; END IF;
 IF NOT public.can_bypass_pauta_lock(school,'40000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001',auth.uid()) THEN RAISE EXCEPTION 'secretaria exception cannot be consumed by grade writer'; END IF;
 IF public.can_bypass_pauta_lock(school,'40000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'exception leaked to another user'; END IF;
END $$;
RESET ROLE;
-- Change the live formula input, deliberately leaving the MV at the old grade.
UPDATE internal.fixture_notas SET nota_final=12;
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r:=public.resolve_raa_decreto_for_matricula('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001');
 IF r->>'decision'<>'transitou' THEN RAISE EXCEPTION 'grade correction still depends on stale MV: %',r; END IF;
END $$;
RESET ROLE;
UPDATE internal.fixture_notas SET nota_final=7;
SET LOCAL ROLE authenticated;
SELECT public.balcao_resolver_academico('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','abrir_exame','{"motivo":"Sessão extraordinária criada pela secretaria","tipo":"extraordinario","modalidade":"escrita_oral","data_inicio":"2026-01-02","data_fim":"2026-01-03","componentes":[{"codigo":"escrita","peso":1},{"codigo":"oral","peso":1}]}','b0000000-0000-4000-8000-000000000001');
RESET ROLE;
INSERT INTO public.exame_resultados(escola_id,exame_sessao_id,exame_componente_id,matricula_id,aluno_id,turma_disciplina_id,nota,estado,lancado_por)
 SELECT s.escola_id,s.id,c.id,'60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',12,'submetido','10000000-0000-4000-8000-000000000002'
 FROM public.exame_sessoes s JOIN public.exame_componentes c ON c.exame_sessao_id=s.id;
SELECT set_config('test.session_id',(SELECT id::text FROM public.exame_sessoes LIMIT 1),true);
SELECT set_config('test.result_id',(SELECT id::text FROM public.exame_resultados ORDER BY id LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE r jsonb; school uuid:='20000000-0000-4000-8000-000000000001'; source uuid:='60000000-0000-4000-8000-000000000001';
BEGIN
 r:=public.balcao_resolver_academico(school,source,'validar_exame',jsonb_build_object('motivo','Componente confirmado pela secretaria','resultado_id',current_setting('test.result_id')),gen_random_uuid());
 IF r->'academic_after'->>'decision'<>'inscricao_condicional' THEN RAISE EXCEPTION 'single validation must not publish incomplete session'; END IF;
 BEGIN
  PERFORM public.balcao_resolver_academico(school,source,'publicar_exame',jsonb_build_object('motivo','Publicação incompleta deve ser rejeitada','sessao_id',current_setting('test.session_id')),gen_random_uuid());
  RAISE EXCEPTION 'incomplete exam published'; EXCEPTION WHEN check_violation THEN NULL;
 END;
END $$;
RESET ROLE;
SELECT set_config('test.remaining_result_id',(SELECT id::text FROM public.exame_resultados WHERE estado='submetido' LIMIT 1),true);
SET LOCAL ROLE authenticated;
SELECT public.balcao_resolver_academico('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','validar_exame',jsonb_build_object('motivo','Segundo componente confirmado pela secretaria','resultado_id',current_setting('test.remaining_result_id')),gen_random_uuid());
DO $$
DECLARE r jsonb; again jsonb; key uuid:='b0000000-0000-4000-8000-000000000002'; payload jsonb;
BEGIN
 payload:=jsonb_build_object('motivo','Resultados completos publicados pela secretaria','sessao_id',current_setting('test.session_id'));
 r:=public.balcao_resolver_academico('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','publicar_exame',payload,key);
 IF r->'academic_before'->>'decision'<>'inscricao_condicional' OR r->'academic_after'->>'decision'<>'transitou' THEN RAISE EXCEPTION 'publication did not change canonical eligibility: %',r; END IF;
 IF r->>'estado'<>'encerrada' THEN RAISE EXCEPTION 'session not locked after publication'; END IF;
 again:=public.balcao_resolver_academico('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','publicar_exame',payload,key);
 IF again->>'idempotent'<>'true' THEN RAISE EXCEPTION 'publication retry duplicated'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.audit_logs WHERE actor_id='10000000-0000-4000-8000-000000000002' AND action='BALCAO_ACADEMIC_PUBLICAR_EXAME' AND details->'resultado'->'academic_after'->>'decision'='transitou') THEN RAISE EXCEPTION 'secretaria release not audited with effect'; END IF;
 BEGIN
  INSERT INTO public.exame_componentes(escola_id,exame_sessao_id,codigo,peso,nota_max) VALUES('20000000-0000-4000-8000-000000000001',current_setting('test.session_id')::uuid,'pratica',1,20);
  RAISE EXCEPTION 'published components changed'; EXCEPTION WHEN check_violation THEN NULL;
 END;
END $$;
-- EJA: it cannot release without official attendance, then it releases using
-- Suficiente evidence; the old numerical MV is irrelevant for this pathway.
UPDATE public.turmas SET regime='{"nivel_ensino":"eja","modulo_numero":1,"escala":"qualitativa","eh_classe_exame":false}';
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r:=public.balcao_resolver_academico('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','registar_eja','{"motivo":"Avaliação qualitativa confirmada na secretaria","disciplina_id":"70000000-0000-4000-8000-000000000001","suficiente":true,"expected_id":null,"documento_fonte":"ATA-EJA-2026"}',gen_random_uuid());
 IF r->'academic_after'->>'decision'<>'pendente' THEN RAISE EXCEPTION 'EJA missing attendance released'; END IF;
END $$;
RESET ROLE;
INSERT INTO public.frequencia_status_periodo SELECT '20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',30,0,30,id FROM public.periodos_letivos;
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r:=public.resolve_raa_decreto_for_matricula('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001');
 IF r->>'decision'<>'transitou' THEN RAISE EXCEPTION 'official qualitative EJA did not release'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.vw_raa_eja_avaliacoes_atuais) THEN RAISE EXCEPTION 'secretaria cannot read its qualitative evidence'; END IF;
END $$;
RESET ROLE;
INSERT INTO public.reapreciacao_pedidos(escola_id,ano_letivo_id,turma_id,matricula_id,aluno_id,turma_disciplina_id,disciplina_id,motivo,prazo_em,idempotency_key,solicitado_por,resultado_publicado_em)
 VALUES('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','Pedido de reapreciação da classificação',now()+interval '48 hours','fixture-appeal','10000000-0000-4000-8000-000000000002',now());
INSERT INTO public.raa_indisciplina_eventos(escola_id,matricula_id,ano_letivo_id,turma_id,aluno_id,estado,impacta_resultado,registado_por)
 VALUES('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','registado',true,'10000000-0000-4000-8000-000000000002');
INSERT INTO public.aluno_falta_justificacoes(escola_id,matricula_id,aluno_id,status)
 VALUES('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','pending');
SET LOCAL ROLE authenticated;
UPDATE public.reapreciacao_pedidos SET estado='deferido',decisao_motivo='Reapreciação documentada pela secretaria',decidido_por=auth.uid(),decidido_em=now() WHERE escola_id='20000000-0000-4000-8000-000000000001';
DO $$ DECLARE r jsonb; BEGIN
 r:=public.resolve_raa_decreto_for_matricula('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001');
 IF r->>'decision'<>'retido_por_indisciplina' THEN RAISE EXCEPTION 'discipline block not represented before review'; END IF;
END $$;
UPDATE public.raa_indisciplina_eventos SET estado='resolvido',decisao_motivo='Revisão fundamentada e confirmada pela secretaria',resolvido_por=auth.uid(),resolvido_em=now() WHERE escola_id='20000000-0000-4000-8000-000000000001' AND estado='registado';
DO $$ DECLARE r jsonb; BEGIN
 r:=public.resolve_raa_decreto_for_matricula('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001');
 IF r->>'decision'<>'transitou' THEN RAISE EXCEPTION 'discipline review did not remove its own block'; END IF;
END $$;
RESET ROLE;
UPDATE public.turmas SET regime='{"nivel_ensino":"secundario","classe_num":8,"escala":"quantitativa_secundario","eh_classe_exame":false}';
-- Four unjustified absences in a two-period/week subject block progression.
INSERT INTO public.aulas VALUES('a1000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001');
INSERT INTO public.frequencias SELECT ('a2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','falta' FROM generate_series(1,4) n;
UPDATE public.aluno_falta_justificacoes SET frequencia_id='a2000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r:=public.resolve_raa_decreto_for_matricula('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001');
 IF r->>'decision'<>'retido_por_faltas' THEN RAISE EXCEPTION 'unjustified absence block missing: %',r; END IF;
END $$;
RESET ROLE;
-- Deliberately reject audit inserts: the mutation must roll back, rather than
-- silently succeed like the old best-effort audit helper could do.
CREATE FUNCTION public.fixture_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF current_setting('fixture.reject_audit',true)='on' THEN RAISE EXCEPTION 'fixture audit failure'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fixture_reject_audit BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.fixture_reject_audit();
SET LOCAL ROLE authenticated;
SELECT set_config('fixture.reject_audit','on',true);
DO $$ DECLARE rejected boolean:=false; BEGIN
 BEGIN
  UPDATE public.aluno_falta_justificacoes SET status='approved',reviewed_by=auth.uid(),reviewed_at=now(),decision_reason='Justificação aceite pela secretaria' WHERE escola_id='20000000-0000-4000-8000-000000000001' AND status='pending';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'fixture audit failure' THEN RAISE; END IF; rejected:=true;
 END;
 IF NOT rejected OR NOT EXISTS(SELECT 1 FROM public.aluno_falta_justificacoes WHERE status='pending') THEN RAISE EXCEPTION 'mutation survived without audit'; END IF;
END $$;
SELECT set_config('fixture.reject_audit','off',true);
UPDATE public.aluno_falta_justificacoes SET status='approved',reviewed_by=auth.uid(),reviewed_at=now(),decision_reason='Justificação aceite pela secretaria' WHERE escola_id='20000000-0000-4000-8000-000000000001' AND status='pending';
DO $$ BEGIN
 IF public.resolve_raa_decreto_for_matricula('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001')->>'decision'<>'transitou' THEN RAISE EXCEPTION 'approved justification did not remove its own block'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(DISTINCT entity) FROM public.audit_logs WHERE actor_id='10000000-0000-4000-8000-000000000002' AND action LIKE 'RAA_OPERATION_%_UPDATE' AND entity IN ('aluno_falta_justificacoes','raa_indisciplina_eventos','reapreciacao_pedidos'))<>3 THEN RAISE EXCEPTION 'legacy decisions are not all transactionally audited'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;

-- No foreign-school operation is authorized.
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
DO $$ BEGIN
 BEGIN
  PERFORM public.balcao_resolver_academico('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','publicar_exame',jsonb_build_object('motivo','Tentativa estrangeira deve ser recusada','sessao_id',current_setting('test.session_id')),gen_random_uuid());
  RAISE EXCEPTION 'foreign school accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 IF EXISTS(SELECT 1 FROM public.vw_raa_eja_avaliacoes_atuais) THEN RAISE EXCEPTION 'foreign evidence leak'; END IF;
END $$;
ROLLBACK;
\echo BALCAO_ACTIONS_EFFECT_AND_SECRETARIA_PASS
