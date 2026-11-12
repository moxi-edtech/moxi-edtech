BEGIN;
INSERT INTO public.escola_users VALUES('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000091','secretaria');
INSERT INTO public.anos_letivos VALUES
('30000000-0000-4000-8000-000000000091','20000000-0000-4000-8000-000000000001',2023,false),
('30000000-0000-4000-8000-000000000092','20000000-0000-4000-8000-000000000001',2024,false),
('30000000-0000-4000-8000-000000000093','20000000-0000-4000-8000-000000000001',2025,false),
('30000000-0000-4000-8000-000000000094','20000000-0000-4000-8000-000000000001',2026,true);
INSERT INTO public.turmas(id,escola_id,regime) VALUES
('40000000-0000-4000-8000-000000000091','20000000-0000-4000-8000-000000000001','{"classe_num":4,"escala":"quantitativa_primario"}'),
('40000000-0000-4000-8000-000000000092','20000000-0000-4000-8000-000000000001','{"classe_num":5}'),
('40000000-0000-4000-8000-000000000093','20000000-0000-4000-8000-000000000001','{"classe_num":6}');
INSERT INTO public.matriculas(id,escola_id,aluno_id,turma_id,session_id,ano_letivo,status,ativo,status_fecho_origem) VALUES
('60000000-0000-4000-8000-000000000091','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000091','40000000-0000-4000-8000-000000000091','30000000-0000-4000-8000-000000000091',2023,'pendente',false,'manual'),
('60000000-0000-4000-8000-000000000092','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000091','40000000-0000-4000-8000-000000000092','30000000-0000-4000-8000-000000000092',2024,'pendente',false,'manual'),
('60000000-0000-4000-8000-000000000093','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000091','40000000-0000-4000-8000-000000000093','30000000-0000-4000-8000-000000000093',2025,'pendente',false,'manual');
INSERT INTO public.mensalidades(escola_id,matricula_id,status,valor,data_vencimento) VALUES
('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000091','pendente',100,current_date-30);
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000091',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.balcao_concluir_ano_percurso('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000092','aprovado');
 RAISE EXCEPTION 'FAIL: skipped unresolved year'; EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE 'ACADEMIC_PREVIOUS_YEAR_PENDING:%' THEN RAISE; END IF; END;
 PERFORM public.balcao_concluir_ano_percurso('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000091','aprovado');
 IF public.resolve_raa_progression_for_matricula('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000091')->>'decision' IS DISTINCT FROM 'transitou' THEN RAISE EXCEPTION 'FAIL: confirmed result not recognized'; END IF;
 PERFORM public.balcao_concluir_ano_percurso('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000091','aprovado');
 BEGIN PERFORM public.balcao_concluir_ano_percurso('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000092','aprovado');
 RAISE EXCEPTION 'FAIL: unpaid previous year ignored'; EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE 'ACADEMIC_PREVIOUS_DEBT_PENDING:%' THEN RAISE; END IF; END;
 BEGIN PERFORM public.balcao_concluir_ano_percurso('20000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000091','aprovado');
 RAISE EXCEPTION 'FAIL: crossed tenant'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.balcao_concluir_ano_percurso('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000091','reprovado');
 RAISE EXCEPTION 'FAIL: rewrote frozen result'; EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
RESET ROLE;
UPDATE public.mensalidades SET status='pago',valor_pago_total=100;
SET LOCAL ROLE authenticated;
SELECT public.balcao_concluir_ano_percurso('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000092','aprovado');
SELECT set_config('fixture.fail','on',true);
DO $$ BEGIN
 BEGIN PERFORM public.balcao_concluir_ano_percurso('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000093','reprovado');
 RAISE EXCEPTION 'FAIL: synthetic snapshot failure not propagated'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'synthetic_snapshot_failure' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM public.historico_anos WHERE matricula_id='60000000-0000-4000-8000-000000000093') THEN RAISE EXCEPTION 'FAIL: partial result escaped rollback'; END IF;
END $$;
SELECT set_config('fixture.fail','off',true);
SELECT public.balcao_concluir_ano_percurso('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000093','reprovado');
DO $$ BEGIN
 IF public.resolve_raa_progression_for_matricula('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000093')->>'decision' IS DISTINCT FROM 'retido' THEN RAISE EXCEPTION 'FAIL: retention promoted'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.notas)<>0 THEN RAISE EXCEPTION 'FAIL: fabricated grades'; END IF;
 IF (SELECT count(*) FROM public.audit_logs WHERE action='BALCAO_ANO_PERCURSO_CONCLUIDO')<>3 THEN RAISE EXCEPTION 'FAIL: missing or duplicated audit'; END IF;
END $$;
ROLLBACK;

-- A ready RAA result must not let a partial transcription masquerade as complete.
BEGIN;
INSERT INTO public.escola_users VALUES('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000091','secretaria');
INSERT INTO public.anos_letivos VALUES
('30000000-0000-4000-8000-000000000091','20000000-0000-4000-8000-000000000001',2025,false),
('30000000-0000-4000-8000-000000000092','20000000-0000-4000-8000-000000000001',2026,true);
INSERT INTO public.turmas(id,escola_id,regime) VALUES('40000000-0000-4000-8000-000000000091','20000000-0000-4000-8000-000000000001','{"classe_num":4,"escala":"quantitativa_primario"}');
INSERT INTO public.matriculas(id,escola_id,aluno_id,turma_id,session_id,ano_letivo,status,ativo,status_fecho_origem) VALUES
('60000000-0000-4000-8000-000000000091','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000091','40000000-0000-4000-8000-000000000091','30000000-0000-4000-8000-000000000091',2025,'pendente',false,'manual');
INSERT INTO public.configuracoes_escola(escola_id,avaliacao_config) VALUES('20000000-0000-4000-8000-000000000001','[{"code":"MAC"},{"code":"NPP"},{"code":"NPT"},{"code":"EXTRA","ativo":false}]');
INSERT INTO public.curso_matriz(id,escola_id) VALUES('70000000-0000-4000-8000-000000000091','20000000-0000-4000-8000-000000000001');
INSERT INTO public.turma_disciplinas VALUES('71000000-0000-4000-8000-000000000091','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000091','70000000-0000-4000-8000-000000000091',NULL);
INSERT INTO public.avaliacoes SELECT gen_random_uuid(),'20000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000091',n,code FROM generate_series(1,3)n CROSS JOIN unnest(ARRAY['MAC','NPP','PT'])code;
CREATE OR REPLACE FUNCTION public.resolve_raa_progression_for_matricula_generic(uuid,uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{"decision":"transitou","destino":"proxima_etapa","disciplina_ids_pendentes":[]}'::jsonb $$;
INSERT INTO public.notas(escola_id,matricula_id,avaliacao_id,valor) SELECT escola_id,'60000000-0000-4000-8000-000000000091',id,0 FROM public.avaliacoes WHERE trimestre=1 AND tipo='MAC';
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000091',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF public.balcao_pauta_completa('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000091') THEN RAISE EXCEPTION 'FAIL: one mark is not a completed year'; END IF;
 BEGIN PERFORM public.finalizar_origem_academica('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000091','aprovado','raa');
 RAISE EXCEPTION 'FAIL: direct generic RPC bypassed full transcription'; EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE 'ACADEMIC_GRADES_INCOMPLETE:%' THEN RAISE; END IF; END;
 BEGIN PERFORM public.balcao_concluir_ano_percurso('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000091',NULL,'notas');
 RAISE EXCEPTION 'FAIL: partial year closed'; EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE 'ACADEMIC_GRADES_INCOMPLETE:%' THEN RAISE; END IF; END;
 BEGIN PERFORM public.balcao_concluir_ano_percurso('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000091','aprovado','resultado');
 RAISE EXCEPTION 'FAIL: partial grades bypassed with a manual outcome'; EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE 'ACADEMIC_DOCUMENT_GRADES_PRESENT:%' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
INSERT INTO public.notas(escola_id,matricula_id,avaliacao_id,valor) SELECT a.escola_id,'60000000-0000-4000-8000-000000000091',a.id,7 FROM public.avaliacoes a WHERE NOT EXISTS(SELECT 1 FROM public.notas n WHERE n.avaliacao_id=a.id);
-- Another pupil in the same class has no grades at all. Their incomplete
-- work must never block this pupil or be edited by an individual recovery.
INSERT INTO public.matriculas(id,escola_id,aluno_id,turma_id,session_id,ano_letivo,status,ativo,status_fecho_origem) VALUES
('60000000-0000-4000-8000-000000000099','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000099','40000000-0000-4000-8000-000000000091','30000000-0000-4000-8000-000000000091',2025,'pendente',false,'manual');
-- The subject is offered only in trimester 1: periods 2/3 are not invented requirements.
UPDATE public.turma_disciplinas SET periodos_ativos=ARRAY[1];
DELETE FROM public.notas WHERE avaliacao_id IN (SELECT id FROM public.avaliacoes WHERE trimestre IN (2,3));
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF NOT public.balcao_pauta_completa('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000091') THEN RAISE EXCEPTION 'FAIL: inactive terms were required'; END IF;
END $$;
RESET ROLE;
UPDATE public.turma_disciplinas SET periodos_ativos=NULL;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF public.balcao_pauta_completa('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000091') THEN RAISE EXCEPTION 'FAIL: missing active terms ignored'; END IF;
END $$;
RESET ROLE;
INSERT INTO public.notas(escola_id,matricula_id,avaliacao_id,valor) SELECT a.escola_id,'60000000-0000-4000-8000-000000000091',a.id,7 FROM public.avaliacoes a WHERE NOT EXISTS(SELECT 1 FROM public.notas n WHERE n.avaliacao_id=a.id);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF NOT public.balcao_pauta_completa('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000091') THEN RAISE EXCEPTION 'FAIL: all components with a genuine zero should be complete'; END IF;
 PERFORM public.balcao_concluir_ano_percurso('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000091','reprovado','notas');
 IF NOT EXISTS(SELECT 1 FROM public.historico_anos WHERE matricula_id='60000000-0000-4000-8000-000000000091' AND resultado_final='aprovado' AND snapshot_status='fechado') THEN RAISE EXCEPTION 'FAIL: RAA result was overridden by caller'; END IF;
 IF EXISTS(SELECT 1 FROM public.historico_anos WHERE matricula_id='60000000-0000-4000-8000-000000000099') THEN RAISE EXCEPTION 'FAIL: changed another pupil'; END IF;
 IF public.balcao_pauta_completa('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000099') THEN RAISE EXCEPTION 'FAIL: grades leaked to a classmate'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
