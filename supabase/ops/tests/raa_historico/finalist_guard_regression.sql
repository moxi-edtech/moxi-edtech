-- Run only in the disposable finalist_guard_fixture.sql PostgreSQL database.
BEGIN;
INSERT INTO public.escolas VALUES
 ('20000000-0000-4000-8000-000000000001','COMPLEXO ESCOLAR PRIVADO ADVETISTA DE CURTUME');
INSERT INTO public.escola_users VALUES
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','diretor'),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','admin_financeiro');
INSERT INTO public.classes VALUES
 ('30000000-0000-4000-8000-000000000008','20000000-0000-4000-8000-000000000001','8ª Classe',8),
 ('30000000-0000-4000-8000-000000000009','20000000-0000-4000-8000-000000000001','9ª Classe',9);
INSERT INTO public.turmas
 (id,regime,escola_id,curso_id,classe_id,ano_letivo,session_id,classe_num)
VALUES
 ('40000000-0000-4000-8000-000000000008','{"nivel_ensino":"secundario","classe_num":8,"eh_classe_exame":false}'::jsonb,'20000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000008',2025,'70000000-0000-4000-8000-000000000025',8),
 ('40000000-0000-4000-8000-000000000009','{"nivel_ensino":"secundario","classe_num":9,"eh_classe_exame":true}'::jsonb,'20000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000009',2025,'70000000-0000-4000-8000-000000000025',9),
 ('40000000-0000-4000-8000-000000000019','{"nivel_ensino":"secundario","classe_num":9,"eh_classe_exame":true}'::jsonb,'20000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000009',2026,'70000000-0000-4000-8000-000000000026',9);
INSERT INTO public.academic_transition_cohorts
 (id,escola_id,ano_origem,ano_destino,modo,ativo,expira_em)
VALUES
 ('80000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',2025,2026,'virada_assistida_sem_notas',true,CURRENT_DATE+365);
INSERT INTO public.matriculas
 (id,escola_id,aluno_id,turma_id,session_id,ano_letivo,status,ativo,status_fecho_origem,origem_transicao_matricula_id)
VALUES
 -- 9th-grade pupil who passed; the invalid next-year 9th was VOIDED.
 ('60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000009','70000000-0000-4000-8000-000000000025',2025,'concluido',false,'override_admin',NULL),
 ('60000000-0000-4000-8000-000000000101','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000019','70000000-0000-4000-8000-000000000026',2026,'anulado',false,'manual','60000000-0000-4000-8000-000000000001'),
 -- 8th-grade pupil who passed; a normal next-grade progression.
 ('60000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000008','70000000-0000-4000-8000-000000000025',2025,'concluido',false,'override_admin',NULL),
 -- 9th-grade pupil whose invalid next-year registration remains ACTIVE.
 ('60000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000009','70000000-0000-4000-8000-000000000025',2025,'concluido',false,'override_admin',NULL),
 ('60000000-0000-4000-8000-000000000103','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000019','70000000-0000-4000-8000-000000000026',2026,'ativo',true,'manual','60000000-0000-4000-8000-000000000003');
INSERT INTO public.historico_anos
 (escola_id,aluno_id,ano_letivo,matricula_id,ano_letivo_id,turma_id,resultado_final,status_final,snapshot_status)
VALUES
 ('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',2025,'60000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000025','40000000-0000-4000-8000-000000000009','aprovado','aprovado','aberto'),
 ('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002',2025,'60000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000025','40000000-0000-4000-8000-000000000008','aprovado','aprovado','aberto'),
 ('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000003',2025,'60000000-0000-4000-8000-000000000003','70000000-0000-4000-8000-000000000025','40000000-0000-4000-8000-000000000009','aprovado','aprovado','aberto');
INSERT INTO public.academic_transition_cohort_members
 (id,escola_id,cohort_id,aluno_id,matricula_origem_id,status)
SELECT gen_random_uuid(),m.escola_id,'80000000-0000-4000-8000-000000000001',
       m.aluno_id,m.id,'elegivel'
FROM public.matriculas m WHERE m.ano_letivo=2025;

-- Minimal legal FK attachment also performed by the real lifecycle trigger.
CREATE FUNCTION public.fixture_finalist_lock_link() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='fechado' THEN
   SELECT h.id INTO NEW.historico_ano_id
   FROM public.historico_anos h
   WHERE h.escola_id=NEW.escola_id
     AND h.matricula_id=NEW.matricula_id
     AND h.ano_letivo_id=NEW.ano_letivo_id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fixture_finalist_history_link
BEFORE INSERT OR UPDATE ON public.historico_snapshot_locks
FOR EACH ROW EXECUTE FUNCTION public.fixture_finalist_lock_link();

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
DO $pre$
BEGIN
 IF public.resolve_raa_progression_for_matricula(
     '20000000-0000-4000-8000-000000000001',
     '60000000-0000-4000-8000-000000000001')->>'decision' <> 'pendente'
 THEN RAISE EXCEPTION 'FAIL: unratified prior-year result cannot bypass RAA'; END IF;
END $pre$;
-- A director must attest the actual school record; no grades, exams or
-- attendance are invented for a closed historical school year.
SELECT public.ratificar_resultado_historico_escola(
 '20000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000001',
 'aprovado','PAUTA-ORIGINAL-2025','Direção conferiu a pauta física original de 2025');
SELECT public.historico_set_snapshot_state(
 '20000000-0000-4000-8000-000000000001',
 ARRAY['60000000-0000-4000-8000-000000000001'::uuid],
 '70000000-0000-4000-8000-000000000025',
 'fechado','Histórico de origem ratificado pela direção da escola',NULL);
DO $finalist$
DECLARE r jsonb;
BEGIN
 r := public.resolve_raa_progression_for_matricula(
      '20000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000001');
 IF r->>'decision' IS DISTINCT FROM 'concluiu'
    OR r->>'destino' IS DISTINCT FROM 'conclusao'
    OR r->>'fonte_decisao' IS DISTINCT FROM 'historico_documental_ratificado'
 THEN RAISE EXCEPTION 'FAIL: ratified 9th finalist remains pending or was promoted as ordinary: %',r; END IF;
END $finalist$;

-- An ordinary prior-year approval must still mean transitou.
SELECT public.ratificar_resultado_historico_escola(
 '20000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000002',
 'aprovado','PAUTA-ORIGINAL-2025','Direção conferiu a pauta física original de 2025');
SELECT public.historico_set_snapshot_state(
 '20000000-0000-4000-8000-000000000001',
 ARRAY['60000000-0000-4000-8000-000000000002'::uuid],
 '70000000-0000-4000-8000-000000000025',
 'fechado','Histórico de origem ratificado pela direção da escola',NULL);
DO $ordinary$
DECLARE r jsonb;
BEGIN
 r := public.resolve_raa_progression_for_matricula(
      '20000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000002');
 IF r->>'decision' IS DISTINCT FROM 'transitou'
    OR r->>'destino' IS DISTINCT FROM 'proxima_etapa'
 THEN RAISE EXCEPTION 'FAIL: an ordinary 8th grade must transit normally: %',r; END IF;
END $ordinary$;

-- A still-active wrong same-grade target is NOT ignored by the guard.
SELECT public.ratificar_resultado_historico_escola(
 '20000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000003',
 'aprovado','PAUTA-ORIGINAL-2025','Direção conferiu a pauta física original de 2025');
DO $must_reject$
BEGIN
 BEGIN
   PERFORM public.historico_set_snapshot_state(
     '20000000-0000-4000-8000-000000000001',
     ARRAY['60000000-0000-4000-8000-000000000003'::uuid],
     '70000000-0000-4000-8000-000000000025',
     'fechado','Fecho deve recusar a matrícula ativa na mesma classe',NULL);
   RAISE EXCEPTION 'FAIL: active invalid 9th target bypassed the guard';
 EXCEPTION WHEN check_violation THEN
   NULL;
 END;
END $must_reject$;

-- Inspect protected internal state as fixture owner, not as an authenticated
-- school user. No additional grants on historico_snapshot_locks.
RESET ROLE;
DO $no_partial_lock$
BEGIN
  IF EXISTS (SELECT 1 FROM public.historico_snapshot_locks
             WHERE matricula_id='60000000-0000-4000-8000-000000000003') THEN
    RAISE EXCEPTION 'FAIL: failed legal lock left a partial row';
  END IF;
END $no_partial_lock$;
SET ROLE authenticated;

-- No numeric notes or invented attendance should appear in this test.
DO $no_forgery$
BEGIN
 IF EXISTS (SELECT 1 FROM public.notas) THEN
  RAISE EXCEPTION 'FAIL: documentary outcome invented numerical grades';
 END IF;
END $no_forgery$;
ROLLBACK;
