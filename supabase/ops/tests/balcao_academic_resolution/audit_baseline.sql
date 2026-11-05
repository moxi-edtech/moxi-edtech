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
DO $$ BEGIN
 BEGIN
  PERFORM public.balcao_resolver_academico('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','reabrir_periodo','{"motivo":"Correção validada na secretaria da escola","periodo_id":"90000000-0000-4000-8000-000000000001","disciplina_id":"70000000-0000-4000-8000-000000000001"}',gen_random_uuid());
  RAISE EXCEPTION 'Baseline unexpectedly allows secretaria';
 EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'BASELINE_SECRETARIA_DENIED_CONFIRMED'; END;
END $$;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
SELECT public.balcao_resolver_academico('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','abrir_exame','{"motivo":"Sessão extraordinária confirmada em ata","tipo":"extraordinario","modalidade":"simples","data_inicio":"2026-01-02","data_fim":"2026-01-03","componentes":[{"codigo":"escrita","peso":1}]}',gen_random_uuid());
RESET ROLE;
INSERT INTO public.exame_resultados(escola_id,exame_sessao_id,exame_componente_id,matricula_id,aluno_id,turma_disciplina_id,nota,estado,lancado_por)
 SELECT s.escola_id,s.id,c.id,'60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',12,'submetido','10000000-0000-4000-8000-000000000001'
 FROM public.exame_sessoes s JOIN public.exame_componentes c ON c.exame_sessao_id=s.id;
SELECT set_config('test.result_id',(SELECT id::text FROM public.exame_resultados LIMIT 1),true);
SET LOCAL ROLE authenticated;
SELECT public.balcao_resolver_academico('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','validar_exame',jsonb_build_object('motivo','Resultado confirmado em reunião académica','resultado_id',current_setting('test.result_id')),gen_random_uuid());
DO $$ DECLARE r jsonb; BEGIN
 r:=public.resolve_raa_decreto_for_matricula('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001');
 IF r->>'decision'<>'inscricao_condicional' OR (r->>'efetivacao_matricula_bloqueada')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'Baseline reproduction changed: %',r; END IF;
 RAISE NOTICE 'BASELINE_VALIDATION_WITHOUT_RELEASE_CONFIRMED: %',r;
END $$;
ROLLBACK;
