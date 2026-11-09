-- Disposable school data; no customer rows or remote connections.
BEGIN;
INSERT INTO public.escola_users(escola_id,user_id,papel) VALUES
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','diretor'),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','admin_financeiro'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','diretor');
INSERT INTO public.turmas VALUES
 ('40000000-0000-4000-8000-000000000001','{"nivel_ensino":"secundario","classe_num":7,"escala":"quantitativa_secundario"}');
INSERT INTO public.academic_transition_cohorts VALUES (
 '80000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
 2025,2026,'virada_assistida_sem_notas',true,CURRENT_DATE+365
);
INSERT INTO public.matriculas(id,escola_id,aluno_id,turma_id,session_id,ano_letivo,status,ativo,status_fecho_origem)
VALUES
 ('60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',2025,'pendente',false,'manual'),
 ('60000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',2025,'pendente',false,'manual'),
 ('60000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',2025,'pendente',false,'manual');
INSERT INTO public.academic_transition_cohort_members(
 id,escola_id,cohort_id,aluno_id,matricula_origem_id,status
) SELECT gen_random_uuid(),escola_id,'80000000-0000-4000-8000-000000000001',aluno_id,id,'elegivel'
FROM public.matriculas;

-- In production lifecycle_validate_historico_legal_lock attaches this ID.
-- Emulate that trigger only for this minimal disposable fixture.
CREATE FUNCTION public.fixture_link_legal_history() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='fechado' THEN
   SELECT id INTO NEW.historico_ano_id FROM public.historico_anos
   WHERE escola_id=NEW.escola_id AND matricula_id=NEW.matricula_id
     AND ano_letivo_id=NEW.ano_letivo_id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fixture_legal_history_before
BEFORE INSERT OR UPDATE ON public.historico_snapshot_locks
FOR EACH ROW EXECUTE FUNCTION public.fixture_link_legal_history();

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);

DO $pre$
DECLARE r jsonb;
BEGIN
 r:=public.resolve_raa_progression_for_matricula(
  '20000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001');
 IF r->>'decision'<>'pendente' THEN
   RAISE EXCEPTION 'FAIL: mere cohort membership must not approve';
 END IF;
END $pre$;

-- Finance-role aliases must not inherit historical academic decision rights.
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
DO $finance$
BEGIN
 BEGIN
  PERFORM public.finalizar_origem_academica(
   '20000000-0000-4000-8000-000000000001',
   '60000000-0000-4000-8000-000000000001',
   'aprovado','declaracao_administrativa_escola',
   'ATA-CUR-TESTE/2025 - Decisão validada pela escola',
   'Referência documental original em arquivo.');
  RAISE EXCEPTION 'FAIL: financial admin recorded historical outcome';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $finance$;

-- Director records actual documented outcome (never synthetic marks).
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
SELECT public.finalizar_origem_academica(
 '20000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000001',
 'aprovado','declaracao_administrativa_escola',
 'ATA-CUR-TESTE/2025 - Aprovado pela escola',
 'Referência documental original em arquivo.'
);
DO $before_ratification$
BEGIN
 IF (public.resolve_raa_progression_for_matricula(
  '20000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001')->>'decision')<>'pendente' THEN
   RAISE EXCEPTION 'FAIL: decision before ratification cannot release RAA';
 END IF;
END $before_ratification$;

-- A director cannot bypass documentary ratification via the generic
-- historical snapshot RPC after registering a grade-less decision.
DO $unratified_close$
BEGIN
 BEGIN
  PERFORM public.historico_set_snapshot_state(
   '20000000-0000-4000-8000-000000000001',
   ARRAY['60000000-0000-4000-8000-000000000001'::uuid],
   '30000000-0000-4000-8000-000000000001',
   'fechado','Tentativa de fecho sem ratificação não autorizada',NULL);
  RAISE EXCEPTION 'FAIL: director bypassed missing ratification';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $unratified_close$;

SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
DO $finance_ratification$
BEGIN
 BEGIN
  PERFORM public.ratificar_resultado_historico_escola(
   '20000000-0000-4000-8000-000000000001',
   '60000000-0000-4000-8000-000000000001',
   'aprovado','ATA-CUR-TESTE/2025','Decisão de aprovação no histórico.');
  RAISE EXCEPTION 'FAIL: financial admin ratified historical outcome';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $finance_ratification$;

SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
SELECT public.ratificar_resultado_historico_escola(
 '20000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000001',
 'aprovado','ATA-CUR-TESTE/2025','Decisão de aprovação no histórico.'
);
DO $before_close$
BEGIN
 IF (public.resolve_raa_progression_for_matricula(
  '20000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001')->>'decision')<>'pendente' THEN
   RAISE EXCEPTION 'FAIL: ratification before lock cannot release RAA';
 END IF;
END $before_close$;

SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
DO $finance_lock$
BEGIN
 BEGIN
  PERFORM public.historico_set_snapshot_state(
   '20000000-0000-4000-8000-000000000001',
   ARRAY['60000000-0000-4000-8000-000000000001'::uuid],
   '30000000-0000-4000-8000-000000000001',
   'fechado','Fecho solicitado por financeiro: proibido',NULL);
  RAISE EXCEPTION 'FAIL: financial admin closed documentary history';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $finance_lock$;

SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
SELECT public.historico_set_snapshot_state(
 '20000000-0000-4000-8000-000000000001',
 ARRAY['60000000-0000-4000-8000-000000000001'::uuid],
 '30000000-0000-4000-8000-000000000001',
 'fechado','Documentação ratificada pela direção para fecho legal',NULL
);
DO $approved$
DECLARE r jsonb;
BEGIN
 r:=public.resolve_raa_progression_for_matricula(
  '20000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001');
 IF r->>'decision'<>'transitou' OR r->>'destino'<>'proxima_etapa'
   OR r->>'fonte_decisao'<>'historico_documental_ratificado' THEN
   RAISE EXCEPTION 'FAIL: signed legal outcome not recognized: %',r;
 END IF;
END $approved$;

-- A grade discovered later blocks documentary override until review.
-- Fixture grade injection is never performed as a school actor.
RESET ROLE;
INSERT INTO public.notas(escola_id,matricula_id) VALUES (
 '20000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000001'
);
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
DO $existing_grades$
BEGIN
 IF (public.resolve_raa_progression_for_matricula(
  '20000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001')->>'decision')<>'pendente' THEN
   RAISE EXCEPTION 'FAIL: documented bypass over actual grades';
 END IF;
END $existing_grades$;
RESET ROLE;
DELETE FROM public.notas;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);

-- Source with a retained result must repeat the same grade.
SELECT public.finalizar_origem_academica(
 '20000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000002',
 'reprovado','declaracao_administrativa_escola',
 'ATA-CUR-REPROVADO - Retenção documentada',
 'Retenção demonstrada por pauta final da escola.'
);
SELECT public.ratificar_resultado_historico_escola(
 '20000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000002',
 'reprovado','ATA-CUR-REPROVADO','Retenção documental validada.');
SELECT public.historico_set_snapshot_state(
 '20000000-0000-4000-8000-000000000001',
 ARRAY['60000000-0000-4000-8000-000000000002'::uuid],
 '30000000-0000-4000-8000-000000000001',
 'fechado','Retenção documentada e ratificada pela direção',NULL);
DO $retained$
DECLARE r jsonb;
BEGIN
 r:=public.resolve_raa_progression_for_matricula(
  '20000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000002');
 IF r->>'decision'<>'retido' OR r->>'destino'<>'mesma_etapa' THEN
   RAISE EXCEPTION 'FAIL: retained year promoted: %',r;
 END IF;
END $retained$;

-- A terminal cycle is never eligible for reenrollment.
SELECT public.finalizar_origem_academica(
 '20000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000003',
 'concluido','declaracao_administrativa_escola',
 'ATA-CUR-CONCLUSAO - Ciclo concluído documentado',
 'Documento da conclusão oficial do ciclo.'
);
SELECT public.ratificar_resultado_historico_escola(
 '20000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000003',
 'concluido','ATA-CUR-CONCLUSAO','Conclusão documental validada.');
SELECT public.historico_set_snapshot_state(
 '20000000-0000-4000-8000-000000000001',
 ARRAY['60000000-0000-4000-8000-000000000003'::uuid],
 '30000000-0000-4000-8000-000000000001',
 'fechado','Conclusão do ciclo ratificada pela direção',NULL);
DO $finalist$
DECLARE r jsonb;
BEGIN
 r:=public.resolve_raa_progression_for_matricula(
  '20000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000003');
 IF r->>'decision'<>'concluiu' OR r->>'destino'<>'conclusao' THEN
  RAISE EXCEPTION 'FAIL: final cycle allowed ordinary reenrollment: %',r;
 END IF;
END $finalist$;

-- Foreign school identity cannot read the documentary decision through RAA.
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
DO $foreign$
BEGIN
 IF (public.resolve_raa_progression_for_matricula(
  '20000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001')->>'decision')='transitou' THEN
  RAISE EXCEPTION 'FAIL: foreign school accessed historical outcome';
 END IF;
END $foreign$;
RESET ROLE;
ROLLBACK;
SELECT 'RAA_HISTORICO_DOCUMENTAL_REGRESSION_PASS' AS result;
