-- Single tenant-scoped safeguard for future enrolments. This is not a
-- Curtume-specific patch: any path that inserts/activates a destination
-- enrolment must respect an already recorded prior-year academic decision.
-- Historical enrolments, marks, payments and invoices are not modified.
CREATE OR REPLACE FUNCTION public.guard_enrollment_prior_year_progression_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public'
AS $function$
DECLARE
  v_target_year integer;
  v_target_class integer;
  v_target_course uuid;
  v_origin_year integer;
  v_origin_class integer;
  v_origin_is_exam boolean;
  v_result text;
BEGIN
  -- No academic eligibility is inferred for drafts, historic closures or
  -- cancellations. Validate when a destination becomes a reservation/active.
  IF NEW.turma_id IS NULL
     OR public.canonicalize_matricula_status_text(NEW.status)
        NOT IN ('pendente','ativo') THEN
    RETURN NEW;
  END IF;

  -- Prevent unrelated updates from retroactively invalidating legacy data.
  IF TG_OP = 'UPDATE' THEN
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

  SELECT t.ano_letivo, coalesce(t.classe_num, c.numero),
         t.curso_id
    INTO v_target_year, v_target_class, v_target_course
  FROM public.turmas t
  LEFT JOIN public.classes c ON c.id = t.classe_id
  WHERE t.id = NEW.turma_id AND t.escola_id = NEW.escola_id;

  -- The canonical context guard already rejects bad school/year/class links.
  -- Without a known numerical grade, do not guess progression from names.
  IF v_target_year IS NULL OR v_target_class IS NULL THEN
    RETURN NEW;
  END IF;

  -- An explicit transition origin allows us to prevent a same-grade exam
  -- enrolment even when the school has NOT yet recorded the final result.
  IF NEW.origem_transicao_matricula_id IS NOT NULL THEN
    SELECT o.ano_letivo, coalesce(ot.classe_num, oc.numero),
           coalesce(ot.is_classe_exame, false)
      INTO v_origin_year, v_origin_class, v_origin_is_exam
    FROM public.matriculas o
    JOIN public.turmas ot
      ON ot.id = o.turma_id AND ot.escola_id = NEW.escola_id
    LEFT JOIN public.classes oc ON oc.id = ot.classe_id
    WHERE o.id = NEW.origem_transicao_matricula_id
      AND o.escola_id = NEW.escola_id
      AND o.aluno_id = NEW.aluno_id;

    IF v_origin_year = v_target_year - 1
       AND v_origin_class IS NOT NULL
       AND v_target_class <= v_origin_class THEN
      SELECT lower(btrim(h.resultado_final))
        INTO v_result
      FROM public.historico_anos h
      WHERE h.escola_id = NEW.escola_id
        AND h.aluno_id = NEW.aluno_id
        AND h.ano_letivo = v_origin_year;

      IF v_result IN ('aprovado', 'concluido') THEN
        RAISE EXCEPTION 'ENROLLMENT_PRIOR_YEAR_APPROVED_SAME_OR_LOWER_GRADE'
          USING ERRCODE = '23514',
                DETAIL = 'A matrícula de origem aprovada requer classe seguinte; corrija o histórico ou o destino pelo fluxo auditado.';
      END IF;

      IF v_target_class = v_origin_class
         AND v_origin_is_exam
         AND coalesce(v_result, '') NOT IN
           ('reprovado', 'reprovado_por_faltas', 'retido') THEN
        RAISE EXCEPTION 'ENROLLMENT_FINALIST_REPEAT_REQUIRES_RETAINED_DECISION'
          USING ERRCODE = '23514',
                DETAIL = 'Classe de exame repetida sem resultado de retenção; confirme a decisão académica antes de rematricular.';
      END IF;
    END IF;
  END IF;

  -- Defense in depth for direct inserts and admission paths without a
  -- transition-origin link. The tenant/year/student lookup is indexed.
  IF EXISTS (
    SELECT 1
      FROM public.historico_anos h
      JOIN public.turmas ot
        ON ot.id = h.turma_id AND ot.escola_id = h.escola_id
      LEFT JOIN public.classes oc ON oc.id = ot.classe_id
     WHERE h.escola_id = NEW.escola_id
       AND h.aluno_id = NEW.aluno_id
       AND h.ano_letivo = v_target_year - 1
       AND lower(btrim(h.resultado_final)) IN ('aprovado','concluido')
       AND ot.curso_id = v_target_course
       AND coalesce(ot.classe_num, oc.numero) >= v_target_class
  ) THEN
    RAISE EXCEPTION 'ENROLLMENT_PRIOR_YEAR_APPROVED_SAME_OR_LOWER_GRADE'
      USING ERRCODE = '23514',
            DETAIL = 'A classe de destino não pode repetir ou regredir uma classe aprovada no ano anterior.';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_enrollment_prior_year_progression_v1()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_klasse_guard_enrollment_prior_year_progression
  ON public.matriculas;
CREATE TRIGGER trg_klasse_guard_enrollment_prior_year_progression
BEFORE INSERT OR UPDATE OF escola_id, aluno_id, turma_id, session_id,
  ano_letivo, origem_transicao_matricula_id, status, ativo
ON public.matriculas
FOR EACH ROW
EXECUTE FUNCTION public.guard_enrollment_prior_year_progression_v1();
