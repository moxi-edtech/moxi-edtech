-- Authoritative RAA guard for future destination activation.
-- The RAA RPC is the only source of academic progression decisions.
-- An unfinished historic result, even if labelled 'aprovado' in an open
-- snapshot, is NOT silently promoted to a legally ratified RAA decision.
-- Draft/reserved enrolments can be prepared without making pupils active.
-- Existing records, grades, receipts, and ledger are not rewritten.
CREATE OR REPLACE FUNCTION public.guard_enrollment_raa_progression_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public'
AS $function$
DECLARE
  v_destination record;
  v_origin record;
  v_raa jsonb;
  v_decision text;
  v_destino text;
  v_blocked boolean;
  v_origin_classe integer;
  v_dest_classe integer;
BEGIN
  IF NEW.turma_id IS NULL
     OR public.canonicalize_matricula_status_text(NEW.status) <> 'ativo' THEN
    RETURN NEW; -- reservations remain possible; activation is authoritative
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Avoid invalidating already-active legacy registrations during ordinary
    -- unrelated changes (payment, contact, dates, etc.).
    IF NEW.escola_id IS NOT DISTINCT FROM OLD.escola_id
       AND NEW.aluno_id IS NOT DISTINCT FROM OLD.aluno_id
       AND NEW.turma_id IS NOT DISTINCT FROM OLD.turma_id
       AND NEW.session_id IS NOT DISTINCT FROM OLD.session_id
       AND NEW.ano_letivo IS NOT DISTINCT FROM OLD.ano_letivo
       AND NEW.origem_transicao_matricula_id IS NOT DISTINCT FROM OLD.origem_transicao_matricula_id
       AND NEW.status IS NOT DISTINCT FROM OLD.status
       AND NEW.ativo IS NOT DISTINCT FROM OLD.ativo THEN
      RETURN NEW;
    END IF;
  END IF;

  -- An explicit same-year class CORRECTION is not a progression. Only the
  -- existing retificar_classe_matricula RPC may issue the protected,
  -- one-student, one-source/target nonce within its transaction. Direct
  -- API/SQL updates never have this nonce (no authenticated table grants).
  IF TG_OP = 'UPDATE' THEN
    IF NEW.turma_id IS DISTINCT FROM OLD.turma_id
       AND NEW.escola_id IS NOT DISTINCT FROM OLD.escola_id
       AND NEW.aluno_id IS NOT DISTINCT FROM OLD.aluno_id
       AND NEW.session_id IS NOT DISTINCT FROM OLD.session_id
       AND NEW.ano_letivo IS NOT DISTINCT FROM OLD.ano_letivo
       AND NEW.origem_transicao_matricula_id IS NOT DISTINCT FROM OLD.origem_transicao_matricula_id
       AND NEW.status IS NOT DISTINCT FROM OLD.status
       AND NEW.ativo IS NOT DISTINCT FROM OLD.ativo
       AND auth.uid() IS NOT NULL
       AND public.current_tenant_escola_id() = NEW.escola_id
       AND EXISTS (
         SELECT 1 FROM public.balcao_pauta_turma_correction_nonce nonce
         WHERE nonce.escola_id = NEW.escola_id
           AND nonce.matricula_id = NEW.id
           AND nonce.actor_id = auth.uid()
           AND nonce.turma_origem_id = OLD.turma_id
           AND nonce.turma_destino_id = NEW.turma_id
       ) THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT id, escola_id, curso_id, ano_letivo, session_id
    INTO v_destination
  FROM public.turmas
  WHERE id = NEW.turma_id AND escola_id = NEW.escola_id;

  IF v_destination.id IS NULL THEN
    RAISE EXCEPTION 'ENROLLMENT_TARGET_NOT_FOUND' USING ERRCODE='23514';
  END IF;

  -- When transition origin is provided, check that exact student, tenant and
  -- academic year. Otherwise locate the school's previous-year enrolment.
  -- New admissions with no earlier enrolment at this school are unaffected.
  IF NEW.origem_transicao_matricula_id IS NOT NULL THEN
    SELECT m.id, m.escola_id, m.aluno_id, m.turma_id, m.ano_letivo,
           t.curso_id AS curso_id
      INTO v_origin
    FROM public.matriculas m
    JOIN public.turmas t ON t.id=m.turma_id AND t.escola_id=m.escola_id
    WHERE m.id=NEW.origem_transicao_matricula_id
      AND m.escola_id=NEW.escola_id
      AND m.aluno_id=NEW.aluno_id;

    IF v_origin.id IS NULL THEN
      RAISE EXCEPTION 'ENROLLMENT_TRANSITION_ORIGIN_INVALID'
        USING ERRCODE='23514';
    END IF;
  ELSE
    SELECT m.id, m.escola_id, m.aluno_id, m.turma_id, m.ano_letivo,
           t.curso_id AS curso_id
      INTO v_origin
    FROM public.matriculas m
    JOIN public.turmas t ON t.id=m.turma_id AND t.escola_id=m.escola_id
    WHERE m.escola_id=NEW.escola_id
      AND m.aluno_id=NEW.aluno_id
      AND m.ano_letivo=v_destination.ano_letivo - 1
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT 1;
  END IF;

  IF v_origin.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_origin.ano_letivo IS DISTINCT FROM v_destination.ano_letivo - 1 THEN
    RAISE EXCEPTION 'ENROLLMENT_TRANSITION_YEAR_INVALID'
      USING ERRCODE='23514',
            DETAIL='Revise o ano de origem e o ano de destino no Balcão.';
  END IF;

  -- No local duplicate of the GradeEngine, no reading of
  -- historico_anos.resultado_final, and no assumption that a closed
  -- enrolment means the learner was approved.
  BEGIN
    v_raa := public.resolve_raa_progression_for_matricula(
      NEW.escola_id, v_origin.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'ENROLLMENT_RAA_UNAVAILABLE'
      USING ERRCODE='23514',
            DETAIL='A decisão do RAA não pôde ser consultada; regularize a origem no Balcão.';
  END;

  v_decision := v_raa->>'decision';
  v_destino := v_raa->>'destino';
  v_blocked := coalesce((v_raa->>'efetivacao_matricula_bloqueada')::boolean, false);

  IF v_raa IS NULL
     OR v_decision IS NULL
     OR v_decision IN ('pendente','recurso','retido_por_faltas',
                       'retido_por_indisciplina') THEN
    RAISE EXCEPTION 'ENROLLMENT_RAA_DECISION_REQUIRED'
      USING ERRCODE='23514',
            DETAIL='Registe ou regularize a decisão académica da matrícula de origem antes da confirmação.';
  END IF;

  IF v_blocked THEN
    RAISE EXCEPTION 'ENROLLMENT_RAA_CONFIRMATION_BLOCKED'
      USING ERRCODE='23514',
            DETAIL='O RAA não permite confirmar esta matrícula até resolver as pendências académicas.';
  END IF;

  v_origin_classe := public.turma_classe_numero(v_origin.turma_id);
  v_dest_classe := public.turma_classe_numero(v_destination.id);

  -- Reject an unknown class rather than inferring from free text.
  IF v_origin_classe IS NULL OR v_dest_classe IS NULL THEN
    RAISE EXCEPTION 'ENROLLMENT_RAA_GRADE_UNRESOLVED'
      USING ERRCODE='23514',
            DETAIL='Configure a classe oficial da turma antes de confirmar a matrícula.';
  END IF;

  IF (v_decision='transitou'
      OR (v_decision='inscricao_condicional' AND v_destino='proxima_etapa'))
     AND v_destino='proxima_etapa'
     AND v_dest_classe=v_origin_classe + 1 THEN
    RETURN NEW;
  END IF;

  IF v_decision='retido'
     AND v_destino='mesma_etapa'
     AND v_destination.curso_id=v_origin.curso_id
     AND v_dest_classe=v_origin_classe THEN
    RETURN NEW;
  END IF;

  -- A finalista can move to a new cycle, but not repeat the completed
  -- class in the old course. The dedicated finalist RPC also audits the
  -- chosen new cycle and the school-specific destination.
  IF v_decision='concluiu'
     AND v_destino='conclusao'
     AND v_destination.curso_id IS DISTINCT FROM v_origin.curso_id
     AND v_dest_classe=v_origin_classe + 1 THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'ENROLLMENT_RAA_DESTINATION_MISMATCH'
    USING ERRCODE='23514',
          DETAIL='A turma destino não corresponde à decisão académica oficial do RAA.';
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_enrollment_raa_progression_v1()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_klasse_guard_enrollment_prior_year_progression
  ON public.matriculas;
DROP TRIGGER IF EXISTS trg_klasse_guard_enrollment_raa_progression
  ON public.matriculas;
CREATE TRIGGER trg_klasse_guard_enrollment_raa_progression
BEFORE INSERT OR UPDATE OF escola_id, aluno_id, turma_id, session_id,
  ano_letivo, origem_transicao_matricula_id, status, ativo
ON public.matriculas
FOR EACH ROW
EXECUTE FUNCTION public.guard_enrollment_raa_progression_v1();
