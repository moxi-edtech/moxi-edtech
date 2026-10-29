-- Curtume legal-close integrity: require the recorded decision to match the next-year placement.
-- Existing GradeEngine, RAA and documentary ratification remain authoritative.
-- Does not write or infer individual grades.
BEGIN;
CREATE OR REPLACE FUNCTION public.curtume_guard_legal_history_destination_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $legal$
DECLARE
  v_origin public.matriculas%ROWTYPE;
  v_result text;
  v_source_grade integer;
  v_target_grade integer;
  v_target_id uuid;
  v_target_link uuid;
  v_target_count integer;
BEGIN
  IF NEW.status IS DISTINCT FROM 'fechado' OR NOT EXISTS (
    SELECT 1 FROM public.escolas e WHERE e.id=NEW.escola_id
      AND e.nome='COMPLEXO ESCOLAR PRIVADO ADVETISTA DE CURTUME'
  ) THEN RETURN NEW; END IF;

  SELECT * INTO v_origin FROM public.matriculas m
    WHERE m.id=NEW.matricula_id AND m.escola_id=NEW.escola_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACADEMIC_ORIGIN_MISSING' USING ERRCODE='23514';
  END IF;

  SELECT h.resultado_final INTO v_result FROM public.historico_anos h
  WHERE h.escola_id=NEW.escola_id AND h.matricula_id=v_origin.id
    AND h.aluno_id=v_origin.aluno_id AND h.ano_letivo=v_origin.ano_letivo;
  IF v_result NOT IN ('aprovado','reprovado','concluido') OR v_result IS NULL THEN
    RAISE EXCEPTION 'ACADEMIC_RESULT_NOT_VERIFIED' USING ERRCODE='23514';
  END IF;

  SELECT CASE WHEN c.nome='Pré-Escolar' THEN 0 ELSE c.numero END
    INTO v_source_grade FROM public.turmas t
    JOIN public.classes c ON c.id=t.classe_id AND c.escola_id=t.escola_id
    WHERE t.id=v_origin.turma_id AND t.escola_id=NEW.escola_id;

  SELECT count(*), min(d.id::text)::uuid, min(d.origem_transicao_matricula_id::text)::uuid
  INTO v_target_count, v_target_id, v_target_link
  FROM public.matriculas d
  WHERE d.escola_id=NEW.escola_id AND d.aluno_id=v_origin.aluno_id
    AND d.ano_letivo=v_origin.ano_letivo+1;

  IF v_target_count=0 THEN RETURN NEW; END IF; -- Leaving school or concluding cycle requires its own documented decision.
  IF v_target_count<>1 OR v_target_link IS DISTINCT FROM v_origin.id THEN
    RAISE EXCEPTION 'ACADEMIC_TRANSITION_LINK_REQUIRED: missing or mismatched historical origin'
      USING ERRCODE='23514';
  END IF;

  SELECT CASE WHEN c.nome='Pré-Escolar' THEN 0 ELSE c.numero END
    INTO v_target_grade FROM public.matriculas d
    JOIN public.turmas t ON t.id=d.turma_id AND t.escola_id=d.escola_id
    JOIN public.classes c ON c.id=t.classe_id AND c.escola_id=t.escola_id
    WHERE d.id=v_target_id AND d.escola_id=NEW.escola_id;
  IF v_source_grade IS NULL OR v_target_grade IS NULL
     OR (v_result='aprovado' AND v_target_grade<>v_source_grade+1)
     OR (v_result='reprovado' AND v_target_grade<>v_source_grade)
     OR v_result='concluido' THEN
    RAISE EXCEPTION 'ACADEMIC_DESTINATION_CONFLICT: reconcile class placement before legal close'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$legal$;
REVOKE ALL ON FUNCTION public.curtume_guard_legal_history_destination_v1() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_curtume_guard_legal_history_destination ON public.historico_snapshot_locks;
CREATE TRIGGER trg_curtume_guard_legal_history_destination
BEFORE INSERT OR UPDATE OF status ON public.historico_snapshot_locks
FOR EACH ROW EXECUTE FUNCTION public.curtume_guard_legal_history_destination_v1();
COMMIT;
