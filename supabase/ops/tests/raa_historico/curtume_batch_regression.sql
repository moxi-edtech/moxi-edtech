-- Synthetic histories. BEGIN/ROLLBACK guarantees this cannot persist.
BEGIN;
INSERT INTO public.escolas VALUES
 ('3744879f-2e19-4671-8995-78604302d8c5','COMPLEXO ESCOLAR PRIVADO ADVETISTA DE CURTUME');
INSERT INTO public.escola_users VALUES
 ('3744879f-2e19-4671-8995-78604302d8c5','10000000-0000-4000-8000-000000000001','diretor'),
 ('3744879f-2e19-4671-8995-78604302d8c5','10000000-0000-4000-8000-000000000002','admin_financeiro');
INSERT INTO public.classes VALUES
 ('30000000-0000-4000-8000-000000000008','3744879f-2e19-4671-8995-78604302d8c5','8ª Classe',8),
 ('30000000-0000-4000-8000-000000000009','3744879f-2e19-4671-8995-78604302d8c5','9ª Classe',9);
INSERT INTO public.turmas(id,regime,escola_id,curso_id,classe_id,ano_letivo,session_id,classe_num)
VALUES
 ('40000000-0000-4000-8000-000000000008','{"nivel_ensino":"secundario","classe_num":8,"eh_classe_exame":false}'::jsonb,
  '3744879f-2e19-4671-8995-78604302d8c5','90000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000008',2025,'70000000-0000-4000-8000-000000000025',8),
 ('40000000-0000-4000-8000-000000000009','{"nivel_ensino":"secundario","classe_num":9,"eh_classe_exame":true}'::jsonb,
  '3744879f-2e19-4671-8995-78604302d8c5','90000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000009',2025,'70000000-0000-4000-8000-000000000025',9),
 ('40000000-0000-4000-8000-000000000019','{"nivel_ensino":"secundario","classe_num":9,"eh_classe_exame":true}'::jsonb,
  '3744879f-2e19-4671-8995-78604302d8c5','90000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000009',2026,'70000000-0000-4000-8000-000000000026',9);
INSERT INTO public.academic_transition_cohorts
 (id,escola_id,ano_origem,ano_destino,modo,ativo,expira_em)
VALUES ('80000000-0000-4000-8000-000000000001',
  '3744879f-2e19-4671-8995-78604302d8c5',2025,2026,
  'virada_assistida_sem_notas',true,CURRENT_DATE+365);

-- Six existing closed 2025 enrolments, no new child is created by the batch.
INSERT INTO public.alunos(id,escola_id,numero_processo)
SELECT ('50000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 '3744879f-2e19-4671-8995-78604302d8c5',
 lpad(i::text,6,'0')
FROM generate_series(1,6) g(i);
INSERT INTO public.matriculas
 (id,escola_id,aluno_id,turma_id,session_id,ano_letivo,status,ativo,status_fecho_origem)
SELECT ('60000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 '3744879f-2e19-4671-8995-78604302d8c5',
 ('50000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 CASE WHEN i IN (1,3) THEN '40000000-0000-4000-8000-000000000009'::uuid
      ELSE '40000000-0000-4000-8000-000000000008'::uuid END,
 '70000000-0000-4000-8000-000000000025'::uuid,2025,
 'concluido',false,'override_admin'
FROM generate_series(1,6) g(i);
INSERT INTO public.matriculas
 (id,escola_id,aluno_id,turma_id,session_id,ano_letivo,status,ativo,status_fecho_origem,origem_transicao_matricula_id)
VALUES
 -- Previously invalid same-grade destination already annulled.
 ('60000000-0000-4000-8000-000000000101','3744879f-2e19-4671-8995-78604302d8c5',
  '50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000019',
  '70000000-0000-4000-8000-000000000026',2026,'anulado',false,'manual',
  '60000000-0000-4000-8000-000000000001'),
 -- Invalid same-grade *active* destination must remain a blocker.
 ('60000000-0000-4000-8000-000000000103','3744879f-2e19-4671-8995-78604302d8c5',
  '50000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000019',
  '70000000-0000-4000-8000-000000000026',2026,'ativo',true,'manual',
  '60000000-0000-4000-8000-000000000003');
INSERT INTO public.historico_anos
 (id,escola_id,aluno_id,ano_letivo,matricula_id,ano_letivo_id,turma_id,resultado_final,status_final,snapshot_status)
SELECT ('91000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 '3744879f-2e19-4671-8995-78604302d8c5',
 ('50000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 2025,
 ('60000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 '70000000-0000-4000-8000-000000000025'::uuid,
 CASE WHEN i IN (1,3) THEN '40000000-0000-4000-8000-000000000009'::uuid
      ELSE '40000000-0000-4000-8000-000000000008'::uuid END,
 CASE WHEN i=4 THEN 'reprovado' ELSE 'aprovado' END,
 CASE WHEN i=4 THEN 'reprovado' ELSE 'aprovado' END,
 'aberto'
FROM generate_series(1,6) g(i);
INSERT INTO public.academic_transition_cohort_members
 (id,escola_id,cohort_id,aluno_id,matricula_origem_id,status)
SELECT gen_random_uuid(),m.escola_id,
 '80000000-0000-4000-8000-000000000001',m.aluno_id,m.id,'elegivel'
FROM public.matriculas m WHERE m.ano_letivo=2025;

-- One faithful source per pupil; pupil 2 carries an old XLSX filename
-- with explicitly correct 2025 school-year metadata.
INSERT INTO public.historico_disciplinas(historico_ano_id,disciplina_id,disciplina_nome,nota_final,notas_detalhe)
SELECT ('91000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 'a0000000-0000-4000-8000-000000000008'::uuid,
 'História', CASE WHEN i=4 THEN 4 ELSE 13 END,
 jsonb_build_object(
 'fonte','pauta_fisica_excel',
 'arquivo', CASE WHEN i=2 THEN 'MAPA_HISTORIA-2023-24.xlsx' ELSE 'PAUTA-2025-26.xlsx' END,
 'aba','Turma de origem','linha',i::text,'ano_letivo','2025',
 'escala','20','numero_processo',lpad(i::text,6,'0'))
FROM generate_series(1,5) g(i);
INSERT INTO public.historico_disciplinas(historico_ano_id,disciplina_id,disciplina_nome,nota_final,notas_detalhe)
VALUES
 ('91000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000009','Geografia',14,
  '{"fonte":"pauta_fisica_excel","arquivo":"PAUTA-2025-26.xlsx","aba":"Turma de origem","linha":"1","ano_letivo":"2025","escala":"20"}');

-- Real operational mark for pupil 5 means archival-auto-close is forbidden.
INSERT INTO public.notas(escola_id,matricula_id)
VALUES ('3744879f-2e19-4671-8995-78604302d8c5',
        '60000000-0000-4000-8000-000000000005');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);

DO $verify$
DECLARE
 v_result jsonb;
 v_again jsonb;
 v_raa jsonb;
 v_audits integer;
 v_locks integer;
BEGIN
 v_result := public.curtume_fechar_pautas_2025_lote(
   '3744879f-2e19-4671-8995-78604302d8c5',
   'b0000000-0000-4000-8000-000000000001',null,10);
 IF v_result->>'ok' <> 'true'
    OR (v_result->>'processados')::integer <> 6
    OR (v_result->>'fechados')::integer <> 3
    OR (v_result->>'bloqueados')::integer <> 3
 THEN RAISE EXCEPTION 'FAILED: expected 3 legal close and 3 skipped source/target errors: %',v_result; END IF;

 SELECT count(*) INTO v_locks FROM public.historico_snapshot_locks l
 WHERE l.escola_id='3744879f-2e19-4671-8995-78604302d8c5' AND l.status='fechado';
 IF v_locks<>3 THEN RAISE EXCEPTION 'FAILED: legal locks inconsistent: %',v_locks; END IF;
 SELECT count(*) INTO v_audits FROM public.audit_logs
 WHERE action='MATRICULA_ORIGEM_RESULTADO_ACADEMICO_REGISTADO';
 IF v_audits<>3 THEN RAISE EXCEPTION 'FAILED: exactly one signed audit per changed pupil: %',v_audits; END IF;

 v_raa := public.resolve_raa_progression_for_matricula(
  '3744879f-2e19-4671-8995-78604302d8c5','60000000-0000-4000-8000-000000000001');
 IF v_raa->>'decision' <> 'concluiu' THEN
  RAISE EXCEPTION 'FAILED: ratified ninth not recognized as completed cycle: %',v_raa; END IF;
 v_raa := public.resolve_raa_progression_for_matricula(
  '3744879f-2e19-4671-8995-78604302d8c5','60000000-0000-4000-8000-000000000002');
 IF v_raa->>'decision' <> 'transitou' THEN
  RAISE EXCEPTION 'FAILED: ratified eighth not promoted: %',v_raa; END IF;
 v_raa := public.resolve_raa_progression_for_matricula(
  '3744879f-2e19-4671-8995-78604302d8c5','60000000-0000-4000-8000-000000000004');
 IF v_raa->>'decision' <> 'retido' THEN
  RAISE EXCEPTION 'FAILED: documented failed pupil changed result: %',v_raa; END IF;

 IF EXISTS(SELECT 1 FROM public.historico_anos h
    WHERE h.id IN ('91000000-0000-4000-8000-000000000003',
                    '91000000-0000-4000-8000-000000000005',
                    '91000000-0000-4000-8000-000000000006')
      AND h.snapshot_status<>'aberto') THEN
    RAISE EXCEPTION 'FAILED: invalid pupil closed'; END IF;
 IF EXISTS(SELECT 1 FROM public.matriculas m WHERE m.ano_letivo=2025
    AND (m.status<>'concluido' OR m.ativo=true)) THEN
    RAISE EXCEPTION 'FAILED: batch modified old enrollments'; END IF;

 v_again := public.curtume_fechar_pautas_2025_lote(
   '3744879f-2e19-4671-8995-78604302d8c5',
   'b0000000-0000-4000-8000-000000000001',null,10);
 IF (v_again->>'fechados')::integer<>0 THEN
  RAISE EXCEPTION 'FAILED: idempotency violation: %',v_again; END IF;
 SELECT count(*) INTO v_audits FROM public.audit_logs
 WHERE action='MATRICULA_ORIGEM_RESULTADO_ACADEMICO_REGISTADO';
 IF v_audits<>3 THEN RAISE EXCEPTION 'FAILED: duplicate signed audits on retry: %',v_audits; END IF;
END $verify$;

-- A financial administrator may NOT confirm a whole academic year in one action.
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
DO $deny$
BEGIN
  BEGIN
    PERFORM public.curtume_fechar_pautas_2025_lote(
      '3744879f-2e19-4671-8995-78604302d8c5',
      'b0000000-0000-4000-8000-000000000002',null,10);
    RAISE EXCEPTION 'FAILED: admin_financeiro was permitted to bulk-sign year';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $deny$;

ROLLBACK;
