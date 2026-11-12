-- Staff-level documentary workflow across five exact school roles.
-- Only disposable synthetic student identities, all writes rolled back.
BEGIN;
INSERT INTO public.turmas(id,regime) VALUES ('40000000-0000-4000-8000-000000000001','{"nivel_ensino":"secundario","classe_num":7,"escala":"quantitativa_secundario"}');
INSERT INTO public.academic_transition_cohorts(id,escola_id,ano_origem,ano_destino,modo,ativo,expira_em)
VALUES ('80000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',2025,2026,'virada_assistida_sem_notas',true,current_date+365);
CREATE FUNCTION public.fixture_link_historico() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='fechado' THEN
   SELECT id INTO NEW.historico_ano_id FROM public.historico_anos
   WHERE escola_id=NEW.escola_id AND matricula_id=NEW.matricula_id
     AND ano_letivo_id=NEW.ano_letivo_id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fixture_historico_link_before
BEFORE INSERT OR UPDATE ON public.historico_snapshot_locks
FOR EACH ROW EXECUTE FUNCTION public.fixture_link_historico();

INSERT INTO public.escola_users(escola_id,user_id,papel) VALUES ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000011','secretaria');
INSERT INTO public.matriculas(id,escola_id,aluno_id,turma_id,session_id,ano_letivo,status,ativo,status_fecho_origem)
VALUES ('60000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000011','40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',2025,'pendente',false,'manual');
INSERT INTO public.academic_transition_cohort_members(id,escola_id,cohort_id,aluno_id,matricula_origem_id,status)
VALUES (gen_random_uuid(),'20000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000011','60000000-0000-4000-8000-000000000011','elegivel');
INSERT INTO public.escola_users(escola_id,user_id,papel) VALUES ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000012','admin');
INSERT INTO public.matriculas(id,escola_id,aluno_id,turma_id,session_id,ano_letivo,status,ativo,status_fecho_origem)
VALUES ('60000000-0000-4000-8000-000000000012','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000012','40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',2025,'pendente',false,'manual');
INSERT INTO public.academic_transition_cohort_members(id,escola_id,cohort_id,aluno_id,matricula_origem_id,status)
VALUES (gen_random_uuid(),'20000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000012','60000000-0000-4000-8000-000000000012','elegivel');
INSERT INTO public.escola_users(escola_id,user_id,papel) VALUES ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000013','admin_financeiro');
INSERT INTO public.matriculas(id,escola_id,aluno_id,turma_id,session_id,ano_letivo,status,ativo,status_fecho_origem)
VALUES ('60000000-0000-4000-8000-000000000013','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000013','40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',2025,'pendente',false,'manual');
INSERT INTO public.academic_transition_cohort_members(id,escola_id,cohort_id,aluno_id,matricula_origem_id,status)
VALUES (gen_random_uuid(),'20000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000013','60000000-0000-4000-8000-000000000013','elegivel');
INSERT INTO public.escola_users(escola_id,user_id,papel) VALUES ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000014','admin_secretaria');
INSERT INTO public.matriculas(id,escola_id,aluno_id,turma_id,session_id,ano_letivo,status,ativo,status_fecho_origem)
VALUES ('60000000-0000-4000-8000-000000000014','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000014','40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',2025,'pendente',false,'manual');
INSERT INTO public.academic_transition_cohort_members(id,escola_id,cohort_id,aluno_id,matricula_origem_id,status)
VALUES (gen_random_uuid(),'20000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000014','60000000-0000-4000-8000-000000000014','elegivel');
INSERT INTO public.escola_users(escola_id,user_id,papel) VALUES ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000015','admin_secretario');
INSERT INTO public.matriculas(id,escola_id,aluno_id,turma_id,session_id,ano_letivo,status,ativo,status_fecho_origem)
VALUES ('60000000-0000-4000-8000-000000000015','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000015','40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',2025,'pendente',false,'manual');
INSERT INTO public.academic_transition_cohort_members(id,escola_id,cohort_id,aluno_id,matricula_origem_id,status)
VALUES (gen_random_uuid(),'20000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000015','60000000-0000-4000-8000-000000000015','elegivel');

-- Direct authenticated RPC coverage: reject non-final/unknown regimes before
-- changing enrollment or history; valid completions are rolled back per case.
DO $cycle_rpc$
DECLARE
  v_test_regime jsonb;
  expected boolean;
  accepted boolean;
  entry jsonb;
BEGIN
  FOR entry IN SELECT value FROM jsonb_array_elements('[
    {"regime":{"classe_num":3},"ok":false},
    {"regime":{"classe_num":7},"ok":false},
    {"regime":{},"ok":false},
    {"regime":null,"ok":false},
    {"regime":{"classe_num":"invalid"},"ok":false},
    {"regime":{"classe_num":6},"ok":true},
    {"regime":{"classe_num":9},"ok":true},
    {"regime":{"classe_num":12},"ok":true},
    {"regime":{"nivel_ensino":"eja","classe_num":6,"modulo_numero":1,"ano_numero":1},"ok":false},
    {"regime":{"nivel_ensino":"eja","modulo_numero":3},"ok":true},
    {"regime":{"nivel_ensino":"eja","ano_numero":2},"ok":true}
  ]'::jsonb)
  LOOP
    v_test_regime := entry->'regime';
    expected := (entry->>'ok')::boolean;
    UPDATE public.turmas SET regime=v_test_regime
      WHERE id='40000000-0000-4000-8000-000000000001';
    PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000011',true);
    SET LOCAL ROLE authenticated;
    accepted := false;
    BEGIN
      PERFORM public.finalizar_origem_academica(
        '20000000-0000-4000-8000-000000000001',
        '60000000-0000-4000-8000-000000000011',
        'concluido','declaracao_administrativa_escola',
        'Synthetic cycle-completion regression','SYNTHETIC-ATA-2025');
      -- Roll back this successful synthetic completion to reuse the same source.
      RAISE EXCEPTION 'synthetic completion rollback' USING ERRCODE='ZT001';
    EXCEPTION
      WHEN SQLSTATE 'ZT001' THEN accepted := true;
      WHEN check_violation THEN
        IF SQLERRM NOT LIKE 'ACADEMIC_CYCLE_NOT_FINAL:%' THEN RAISE; END IF;
    END;
    RESET ROLE;
    IF accepted IS DISTINCT FROM expected THEN
      RAISE EXCEPTION 'Cycle RPC mismatch for regime %, accepted %, expected %',v_test_regime,accepted,expected;
    END IF;
    IF EXISTS(SELECT 1 FROM public.historico_anos
      WHERE matricula_id='60000000-0000-4000-8000-000000000011')
      OR NOT EXISTS(SELECT 1 FROM public.matriculas
        WHERE id='60000000-0000-4000-8000-000000000011' AND status='pendente') THEN
      RAISE EXCEPTION 'Cycle test leaked academic mutations';
    END IF;
  END LOOP;
  UPDATE public.turmas SET regime='{"nivel_ensino":"secundario","classe_num":7,"escala":"quantitativa_secundario"}'
    WHERE id='40000000-0000-4000-8000-000000000001';
END $cycle_rpc$;
SELECT 'BALCAO_DIRECT_CYCLE_RPC_PASS' AS result;

SET ROLE authenticated;

-- secretaria must independently finish a real source within the correct school.
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000011',false);
SELECT public.finalizar_origem_academica('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000011',
  'aprovado','declaracao_administrativa_escola',
  'ATA-2025-SECRETARIA - Resultado comprovado em documentação original',
  'Arquivo escolar original validado');
DO $unratified_11$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.historico_anos
   WHERE matricula_id='60000000-0000-4000-8000-000000000011' AND resultado_final='aprovado' AND snapshot_status='aberto') THEN
   RAISE EXCEPTION 'FAILED secretaria: historical outcome was not registered';
 END IF;
 IF (public.resolve_raa_progression_for_matricula('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000011')->>'decision') <> 'pendente' THEN
   RAISE EXCEPTION 'FAILED secretaria: unratified evidence was treated as official';
 END IF;
END $unratified_11$;
SELECT public.ratificar_resultado_historico_escola(
  '20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000011', 'aprovado','ATA-2025-SECRETARIA',
  'Resultado escolar confirmado com a ata original');
SELECT public.historico_set_snapshot_state(
  '20000000-0000-4000-8000-000000000001',ARRAY['60000000-0000-4000-8000-000000000011'::uuid],'30000000-0000-4000-8000-000000000001',
  'fechado','Fecho documental após ratificação escolar',NULL);
DO $verified_11$
DECLARE result jsonb;
BEGIN
 result:=public.resolve_raa_progression_for_matricula('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000011');
 IF result->>'decision' <> 'transitou' OR result->>'fonte_decisao' <> 'historico_documental_ratificado' THEN
   RAISE EXCEPTION 'FAILED secretaria: ratified historic result %',result;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.audit_logs
    WHERE escola_id='20000000-0000-4000-8000-000000000001' AND entity_id='60000000-0000-4000-8000-000000000011'
      AND action='MATRICULA_ORIGEM_RESULTADO_ACADEMICO_REGISTADO'
      AND details->>'ratificacao'='true'
      AND details->>'papel_autorizado'='secretaria') THEN
   RAISE EXCEPTION 'FAILED secretaria: exact signed-role audit missing';
 END IF;
END $verified_11$;

-- admin must independently finish a real source within the correct school.
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000012',false);
SELECT public.finalizar_origem_academica('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000012',
  'aprovado','declaracao_administrativa_escola',
  'ATA-2025-ADMIN - Resultado comprovado em documentação original',
  'Arquivo escolar original validado');
DO $unratified_12$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.historico_anos
   WHERE matricula_id='60000000-0000-4000-8000-000000000012' AND resultado_final='aprovado' AND snapshot_status='aberto') THEN
   RAISE EXCEPTION 'FAILED admin: historical outcome was not registered';
 END IF;
 IF (public.resolve_raa_progression_for_matricula('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000012')->>'decision') <> 'pendente' THEN
   RAISE EXCEPTION 'FAILED admin: unratified evidence was treated as official';
 END IF;
END $unratified_12$;
SELECT public.ratificar_resultado_historico_escola(
  '20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000012', 'aprovado','ATA-2025-ADMIN',
  'Resultado escolar confirmado com a ata original');
SELECT public.historico_set_snapshot_state(
  '20000000-0000-4000-8000-000000000001',ARRAY['60000000-0000-4000-8000-000000000012'::uuid],'30000000-0000-4000-8000-000000000001',
  'fechado','Fecho documental após ratificação escolar',NULL);
DO $verified_12$
DECLARE result jsonb;
BEGIN
 result:=public.resolve_raa_progression_for_matricula('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000012');
 IF result->>'decision' <> 'transitou' OR result->>'fonte_decisao' <> 'historico_documental_ratificado' THEN
   RAISE EXCEPTION 'FAILED admin: ratified historic result %',result;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.audit_logs
    WHERE escola_id='20000000-0000-4000-8000-000000000001' AND entity_id='60000000-0000-4000-8000-000000000012'
      AND action='MATRICULA_ORIGEM_RESULTADO_ACADEMICO_REGISTADO'
      AND details->>'ratificacao'='true'
      AND details->>'papel_autorizado'='admin') THEN
   RAISE EXCEPTION 'FAILED admin: exact signed-role audit missing';
 END IF;
END $verified_12$;

-- admin_financeiro must independently finish a real source within the correct school.
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000013',false);
SELECT public.finalizar_origem_academica('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000013',
  'aprovado','declaracao_administrativa_escola',
  'ATA-2025-ADMIN_FINANCEIRO - Resultado comprovado em documentação original',
  'Arquivo escolar original validado');
DO $unratified_13$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.historico_anos
   WHERE matricula_id='60000000-0000-4000-8000-000000000013' AND resultado_final='aprovado' AND snapshot_status='aberto') THEN
   RAISE EXCEPTION 'FAILED admin_financeiro: historical outcome was not registered';
 END IF;
 IF (public.resolve_raa_progression_for_matricula('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000013')->>'decision') <> 'pendente' THEN
   RAISE EXCEPTION 'FAILED admin_financeiro: unratified evidence was treated as official';
 END IF;
END $unratified_13$;
SELECT public.ratificar_resultado_historico_escola(
  '20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000013', 'aprovado','ATA-2025-ADMIN_FINANCEIRO',
  'Resultado escolar confirmado com a ata original');
SELECT public.historico_set_snapshot_state(
  '20000000-0000-4000-8000-000000000001',ARRAY['60000000-0000-4000-8000-000000000013'::uuid],'30000000-0000-4000-8000-000000000001',
  'fechado','Fecho documental após ratificação escolar',NULL);
DO $verified_13$
DECLARE result jsonb;
BEGIN
 result:=public.resolve_raa_progression_for_matricula('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000013');
 IF result->>'decision' <> 'transitou' OR result->>'fonte_decisao' <> 'historico_documental_ratificado' THEN
   RAISE EXCEPTION 'FAILED admin_financeiro: ratified historic result %',result;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.audit_logs
    WHERE escola_id='20000000-0000-4000-8000-000000000001' AND entity_id='60000000-0000-4000-8000-000000000013'
      AND action='MATRICULA_ORIGEM_RESULTADO_ACADEMICO_REGISTADO'
      AND details->>'ratificacao'='true'
      AND details->>'papel_autorizado'='admin_financeiro') THEN
   RAISE EXCEPTION 'FAILED admin_financeiro: exact signed-role audit missing';
 END IF;
END $verified_13$;

-- admin_secretaria must independently finish a real source within the correct school.
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000014',false);
SELECT public.finalizar_origem_academica('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000014',
  'aprovado','declaracao_administrativa_escola',
  'ATA-2025-ADMIN_SECRETARIA - Resultado comprovado em documentação original',
  'Arquivo escolar original validado');
DO $unratified_14$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.historico_anos
   WHERE matricula_id='60000000-0000-4000-8000-000000000014' AND resultado_final='aprovado' AND snapshot_status='aberto') THEN
   RAISE EXCEPTION 'FAILED admin_secretaria: historical outcome was not registered';
 END IF;
 IF (public.resolve_raa_progression_for_matricula('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000014')->>'decision') <> 'pendente' THEN
   RAISE EXCEPTION 'FAILED admin_secretaria: unratified evidence was treated as official';
 END IF;
END $unratified_14$;
SELECT public.ratificar_resultado_historico_escola(
  '20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000014', 'aprovado','ATA-2025-ADMIN_SECRETARIA',
  'Resultado escolar confirmado com a ata original');
SELECT public.historico_set_snapshot_state(
  '20000000-0000-4000-8000-000000000001',ARRAY['60000000-0000-4000-8000-000000000014'::uuid],'30000000-0000-4000-8000-000000000001',
  'fechado','Fecho documental após ratificação escolar',NULL);
DO $verified_14$
DECLARE result jsonb;
BEGIN
 result:=public.resolve_raa_progression_for_matricula('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000014');
 IF result->>'decision' <> 'transitou' OR result->>'fonte_decisao' <> 'historico_documental_ratificado' THEN
   RAISE EXCEPTION 'FAILED admin_secretaria: ratified historic result %',result;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.audit_logs
    WHERE escola_id='20000000-0000-4000-8000-000000000001' AND entity_id='60000000-0000-4000-8000-000000000014'
      AND action='MATRICULA_ORIGEM_RESULTADO_ACADEMICO_REGISTADO'
      AND details->>'ratificacao'='true'
      AND details->>'papel_autorizado'='admin_secretaria') THEN
   RAISE EXCEPTION 'FAILED admin_secretaria: exact signed-role audit missing';
 END IF;
END $verified_14$;

-- admin_secretario must independently finish a real source within the correct school.
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000015',false);
SELECT public.finalizar_origem_academica('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000015',
  'aprovado','declaracao_administrativa_escola',
  'ATA-2025-ADMIN_SECRETARIO - Resultado comprovado em documentação original',
  'Arquivo escolar original validado');
DO $unratified_15$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.historico_anos
   WHERE matricula_id='60000000-0000-4000-8000-000000000015' AND resultado_final='aprovado' AND snapshot_status='aberto') THEN
   RAISE EXCEPTION 'FAILED admin_secretario: historical outcome was not registered';
 END IF;
 IF (public.resolve_raa_progression_for_matricula('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000015')->>'decision') <> 'pendente' THEN
   RAISE EXCEPTION 'FAILED admin_secretario: unratified evidence was treated as official';
 END IF;
END $unratified_15$;
SELECT public.ratificar_resultado_historico_escola(
  '20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000015', 'aprovado','ATA-2025-ADMIN_SECRETARIO',
  'Resultado escolar confirmado com a ata original');
SELECT public.historico_set_snapshot_state(
  '20000000-0000-4000-8000-000000000001',ARRAY['60000000-0000-4000-8000-000000000015'::uuid],'30000000-0000-4000-8000-000000000001',
  'fechado','Fecho documental após ratificação escolar',NULL);
DO $verified_15$
DECLARE result jsonb;
BEGIN
 result:=public.resolve_raa_progression_for_matricula('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000015');
 IF result->>'decision' <> 'transitou' OR result->>'fonte_decisao' <> 'historico_documental_ratificado' THEN
   RAISE EXCEPTION 'FAILED admin_secretario: ratified historic result %',result;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.audit_logs
    WHERE escola_id='20000000-0000-4000-8000-000000000001' AND entity_id='60000000-0000-4000-8000-000000000015'
      AND action='MATRICULA_ORIGEM_RESULTADO_ACADEMICO_REGISTADO'
      AND details->>'ratificacao'='true'
      AND details->>'papel_autorizado'='admin_secretario') THEN
   RAISE EXCEPTION 'FAILED admin_secretario: exact signed-role audit missing';
 END IF;
END $verified_15$;

-- Foreign tenant cannot sign a matched enrollment of another school.
RESET ROLE;
INSERT INTO public.escola_users(escola_id,user_id,papel)
VALUES ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000019','admin_financeiro');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000019',false);
DO $cross_school$
BEGIN
 BEGIN
  PERFORM public.ratificar_resultado_historico_escola(
   '20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000011','aprovado','ATA-FOREIGN-2025','Ato sem poderes nesta escola');
  RAISE EXCEPTION 'FAILED: other-school operator ratified target';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $cross_school$;
RESET ROLE;
ROLLBACK;
SELECT 'BALCAO_HISTORIC_OPERATOR_REGRESSION_PASS' AS result;
