-- PostgreSQL 17 integration test with the REAL canonical historic RAA RPC.
-- Execute only after finalist_guard_fixture.sql in a disposable DB.
-- All writes roll back; no customer data or privileges used.
BEGIN;
ALTER TABLE public.matriculas ADD COLUMN created_at timestamptz DEFAULT now();
CREATE TABLE public.balcao_pauta_turma_correction_nonce(
 escola_id uuid,matricula_id uuid,actor_id uuid,turma_origem_id uuid,turma_destino_id uuid
);
CREATE FUNCTION public.turma_classe_numero(p_turma_id uuid) RETURNS integer
LANGUAGE sql STABLE AS $func$
 SELECT c.numero FROM public.turmas t
 JOIN public.classes c ON c.id=t.classe_id AND c.escola_id=t.escola_id
 WHERE t.id=p_turma_id
$func$;
CREATE FUNCTION public.fixture_set_lock_history_id() RETURNS trigger
LANGUAGE plpgsql AS $func$
BEGIN
 IF NEW.status='fechado' THEN
   SELECT h.id INTO NEW.historico_ano_id FROM public.historico_anos h
   WHERE h.escola_id=NEW.escola_id AND h.matricula_id=NEW.matricula_id
   AND h.ano_letivo_id=NEW.ano_letivo_id;
 END IF;
 RETURN NEW;
END;
$func$;
CREATE TRIGGER fixture_set_lock_history_id
BEFORE INSERT OR UPDATE ON public.historico_snapshot_locks
FOR EACH ROW EXECUTE FUNCTION public.fixture_set_lock_history_id();

INSERT INTO public.escolas VALUES
 ('20000000-0000-4000-8000-000000000001','Escola fictícia PG17');
INSERT INTO public.escola_users VALUES
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','diretor');
INSERT INTO public.classes VALUES
 ('30000000-0000-4000-8000-000000000008','20000000-0000-4000-8000-000000000001','8ª Classe',8),
 ('30000000-0000-4000-8000-000000000009','20000000-0000-4000-8000-000000000001','9ª Classe',9),
 ('30000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000001','10ª Classe',10);
INSERT INTO public.turmas(id,regime,escola_id,curso_id,classe_id,ano_letivo,session_id,classe_num)
VALUES
 ('40000000-0000-4000-8000-000000000008','{"nivel_ensino":"secundario","classe_num":8,"eh_classe_exame":false}'::jsonb,'20000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000008',2025,'70000000-0000-4000-8000-000000000025',8),
 ('40000000-0000-4000-8000-000000000009','{"nivel_ensino":"secundario","classe_num":9,"eh_classe_exame":true}'::jsonb,'20000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000009',2025,'70000000-0000-4000-8000-000000000025',9),
 ('40000000-0000-4000-8000-000000000019','{"nivel_ensino":"secundario","classe_num":9,"eh_classe_exame":true}'::jsonb,'20000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000009',2026,'70000000-0000-4000-8000-000000000026',9),
 ('40000000-0000-4000-8000-000000000020','{"nivel_ensino":"secundario","classe_num":10}'::jsonb,'20000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000010',2026,'70000000-0000-4000-8000-000000000026',10);
INSERT INTO public.academic_transition_cohorts
(id,escola_id,ano_origem,ano_destino,modo,ativo,expira_em) VALUES
('80000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',2025,2026,'virada_assistida_sem_notas',true,CURRENT_DATE+365);
INSERT INTO public.matriculas
(id,escola_id,aluno_id,turma_id,session_id,ano_letivo,status,ativo,status_fecho_origem)
VALUES
('60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000009','70000000-0000-4000-8000-000000000025',2025,'concluido',false,'override_admin');
INSERT INTO public.historico_anos
(escola_id,aluno_id,ano_letivo,matricula_id,ano_letivo_id,turma_id,resultado_final,status_final,snapshot_status)
VALUES
('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',2025,'60000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000025','40000000-0000-4000-8000-000000000009','aprovado','aprovado','aberto');
INSERT INTO public.academic_transition_cohort_members
(id,escola_id,cohort_id,aluno_id,matricula_origem_id,status)
VALUES(gen_random_uuid(),'20000000-0000-4000-8000-000000000001',
'80000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',
'60000000-0000-4000-8000-000000000001','elegivel');

GRANT INSERT, SELECT, UPDATE ON public.matriculas TO authenticated;
GRANT SELECT ON public.turmas, public.classes, public.escolas TO authenticated;

-- Candidate is installed only after historical source records are prepared.
\ir ../../../migrations/20271201110000_raa_activation_guard_reconciled.sql
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
DO $before$
DECLARE v_error text;
BEGIN
 IF public.resolve_raa_progression_for_matricula(
 '20000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000001')->>'decision' <> 'pendente'
 THEN RAISE EXCEPTION 'unratified RAA must remain pending'; END IF;
 BEGIN
  INSERT INTO public.matriculas
  (id,escola_id,aluno_id,turma_id,session_id,ano_letivo,status,ativo,origem_transicao_matricula_id)
  VALUES('60000000-0000-4000-8000-000000000102',
    '20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000020','70000000-0000-4000-8000-000000000026',
    2026,'ativo',true,'60000000-0000-4000-8000-000000000001');
 EXCEPTION WHEN check_violation THEN GET STACKED DIAGNOSTICS v_error=MESSAGE_TEXT; END;
 IF v_error IS DISTINCT FROM 'ENROLLMENT_RAA_DECISION_REQUIRED' THEN
  RAISE EXCEPTION 'unratified origin bypassed guard: %',coalesce(v_error,'SUCCESS');
 END IF;
END;
$before$;
SELECT public.ratificar_resultado_historico_escola(
 '20000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000001',
 'aprovado','PAUTA-ORIGINAL-2025','Direção conferiu a pauta física original de 2025');
SELECT public.historico_set_snapshot_state(
 '20000000-0000-4000-8000-000000000001',
 ARRAY['60000000-0000-4000-8000-000000000001'::uuid],
 '70000000-0000-4000-8000-000000000025',
 'fechado','Histórico de origem ratificado pela direção da escola',NULL);
DO $after$
DECLARE v_raa jsonb; v_error text;
BEGIN
 v_raa:=public.resolve_raa_progression_for_matricula(
 '20000000-0000-4000-8000-000000000001',
 '60000000-0000-4000-8000-000000000001');
 IF v_raa->>'decision' IS DISTINCT FROM 'concluiu'
 OR v_raa->>'destino' IS DISTINCT FROM 'conclusao'
 THEN RAISE EXCEPTION 'real RAA did not ratify finalist: %',v_raa; END IF;
 BEGIN
  INSERT INTO public.matriculas
  (id,escola_id,aluno_id,turma_id,session_id,ano_letivo,status,ativo,origem_transicao_matricula_id)
  VALUES('60000000-0000-4000-8000-000000000103',
    '20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000019','70000000-0000-4000-8000-000000000026',
    2026,'ativo',true,'60000000-0000-4000-8000-000000000001');
 EXCEPTION WHEN check_violation THEN GET STACKED DIAGNOSTICS v_error=MESSAGE_TEXT; END;
 IF v_error IS DISTINCT FROM 'ENROLLMENT_RAA_DESTINATION_MISMATCH'
 THEN RAISE EXCEPTION 'same 9th finalist target allowed: %',coalesce(v_error,'SUCCESS'); END IF;
 INSERT INTO public.matriculas
  (id,escola_id,aluno_id,turma_id,session_id,ano_letivo,status,ativo,origem_transicao_matricula_id)
 VALUES('60000000-0000-4000-8000-000000000104',
   '20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',
   '40000000-0000-4000-8000-000000000020','70000000-0000-4000-8000-000000000026',
   2026,'ativo',true,'60000000-0000-4000-8000-000000000001');
 IF (SELECT count(*) FROM public.matriculas WHERE id='60000000-0000-4000-8000-000000000104')<>1
 THEN RAISE EXCEPTION 'valid new-cycle activation missing'; END IF;
END;
$after$;
RESET ROLE;
DO $final$
BEGIN
 IF EXISTS(SELECT 1 FROM public.notas) THEN RAISE EXCEPTION 'numeric grades invented'; END IF;
END;
$final$;
ROLLBACK;
