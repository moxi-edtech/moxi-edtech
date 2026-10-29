-- 29 Oct 2026 | Enrollment context SSOT: protect all writers and use one atomic creation RPC.
-- Scope: academic identity only. Existing financial triggers/receipts are not changed.
BEGIN;

CREATE OR REPLACE FUNCTION public.klasse_guard_matricula_turma_context_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $guard$
DECLARE v_turma record; v_ano record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.alunos a
                 WHERE a.id=NEW.aluno_id AND a.escola_id=NEW.escola_id) THEN
    RAISE EXCEPTION 'ENROLLMENT_STUDENT_TENANT_MISMATCH'
      USING ERRCODE='23514';
  END IF;

  IF NEW.turma_id IS NULL THEN
    IF NEW.status IN ('ativo','ativa','active','concluido','transferido') THEN
      RAISE EXCEPTION 'ENROLLMENT_CLASS_REQUIRED: active/closed enrollment requires a class'
        USING ERRCODE='23514';
    END IF;
    IF NEW.session_id IS NOT NULL THEN
      SELECT id,ano,escola_id INTO v_ano FROM public.anos_letivos WHERE id=NEW.session_id;
      IF NOT FOUND OR v_ano.escola_id IS DISTINCT FROM NEW.escola_id
         OR (NEW.ano_letivo IS NOT NULL AND NEW.ano_letivo<>v_ano.ano) THEN
        RAISE EXCEPTION 'ENROLLMENT_YEAR_TENANT_MISMATCH'
          USING ERRCODE='23514';
      END IF;
      NEW.ano_letivo:=v_ano.ano;
    END IF;
    RETURN NEW;
  END IF;

  SELECT t.id,t.escola_id,t.curso_id,t.classe_id,t.ano_letivo,t.session_id,
         c.escola_id AS classe_escola_id,c.curso_id AS classe_curso_id,
         al.id AS ano_id,al.escola_id AS ano_escola_id,al.ano AS ano_numero
  INTO v_turma
  FROM public.turmas t
  LEFT JOIN public.classes c ON c.id=t.classe_id
  LEFT JOIN public.anos_letivos al ON al.id=t.session_id
  WHERE t.id=NEW.turma_id;

  IF NOT FOUND OR v_turma.escola_id IS DISTINCT FROM NEW.escola_id
     OR v_turma.classe_id IS NULL OR v_turma.curso_id IS NULL
     OR v_turma.classe_escola_id IS DISTINCT FROM NEW.escola_id
     OR v_turma.classe_curso_id IS DISTINCT FROM v_turma.curso_id THEN
    RAISE EXCEPTION 'ENROLLMENT_TURMA_CLASS_COURSE_MISMATCH'
      USING ERRCODE='23514';
  END IF;

  IF v_turma.ano_id IS NULL OR v_turma.ano_escola_id IS DISTINCT FROM NEW.escola_id
     OR v_turma.ano_letivo IS DISTINCT FROM v_turma.ano_numero THEN
    RAISE EXCEPTION 'ENROLLMENT_TURMA_YEAR_MISMATCH'
      USING ERRCODE='23514';
  END IF;

  IF NEW.session_id IS NOT NULL AND NEW.session_id IS DISTINCT FROM v_turma.session_id THEN
    RAISE EXCEPTION 'ENROLLMENT_SESSION_MISMATCH'
      USING ERRCODE='23514';
  END IF;
  IF NEW.ano_letivo IS NOT NULL AND NEW.ano_letivo IS DISTINCT FROM v_turma.ano_letivo THEN
    RAISE EXCEPTION 'ENROLLMENT_ACADEMIC_YEAR_MISMATCH'
      USING ERRCODE='23514';
  END IF;

  -- A turma is the SSOT; never accept a client-supplied year over it.
  NEW.session_id:=v_turma.session_id;
  NEW.ano_letivo:=v_turma.ano_letivo;
  RETURN NEW;
END;
$guard$;
REVOKE ALL ON FUNCTION public.klasse_guard_matricula_turma_context_v1()
  FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_klasse_guard_matricula_turma_context ON public.matriculas;
CREATE TRIGGER trg_klasse_guard_matricula_turma_context
BEFORE INSERT OR UPDATE OF turma_id,session_id,ano_letivo,escola_id,aluno_id,status
ON public.matriculas FOR EACH ROW
EXECUTE FUNCTION public.klasse_guard_matricula_turma_context_v1();

CREATE OR REPLACE FUNCTION public.matricula_criar_confirmar_por_turma_v1(
  p_escola_id uuid, p_aluno_id uuid, p_turma_id uuid, p_ano_letivo_id uuid,
  p_expected_classe_id uuid DEFAULT NULL, p_expected_curso_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $rpc$
DECLARE
  v_actor uuid := auth.uid();
  v_tenant uuid := public.current_tenant_escola_id();
  v_year record;
  v_turma record;
  v_existing public.matriculas%ROWTYPE;
  v_result public.matriculas%ROWTYPE;
  v_number bigint;
  v_count integer;
BEGIN
  IF v_actor IS NULL OR v_tenant IS NULL OR p_escola_id IS DISTINCT FROM v_tenant THEN
    RAISE EXCEPTION 'ENROLLMENT_AUTH_REQUIRED: school context is invalid'
      USING ERRCODE='42501';
  END IF;
  IF NOT public.user_has_role_in_school(p_escola_id,
    ARRAY['secretaria','secretaria_financeiro','admin','admin_escola','staff_admin','admin_financeiro']::text[])
  THEN
    RAISE EXCEPTION 'ENROLLMENT_AUTH_FORBIDDEN: role cannot enroll students'
      USING ERRCODE='42501';
  END IF;
  IF p_aluno_id IS NULL OR p_turma_id IS NULL OR p_ano_letivo_id IS NULL THEN
    RAISE EXCEPTION 'ENROLLMENT_INPUT_MISSING: student, class and academic year are required'
      USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.alunos a
     WHERE a.id=p_aluno_id AND a.escola_id=p_escola_id) THEN
    RAISE EXCEPTION 'ENROLLMENT_STUDENT_TENANT_MISMATCH'
      USING ERRCODE='23514';
  END IF;
  SELECT id,ano INTO v_year FROM public.anos_letivos al
    WHERE al.id=p_ano_letivo_id AND al.escola_id=p_escola_id AND al.ativo=true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ENROLLMENT_YEAR_NOT_ACTIVE: select the configured active academic year'
      USING ERRCODE='23514';
  END IF;
  SELECT t.id,t.curso_id,t.classe_id,t.ano_letivo,t.session_id,
    t.status_validacao,t.status_fecho,t.capacidade_maxima,
    c.curso_id AS class_course,c.escola_id AS class_school
  INTO v_turma
  FROM public.turmas t
  JOIN public.classes c ON c.id=t.classe_id
  WHERE t.id=p_turma_id AND t.escola_id=p_escola_id
  FOR UPDATE OF t;

  IF NOT FOUND OR v_turma.curso_id IS NULL OR v_turma.classe_id IS NULL
     OR v_turma.class_course IS DISTINCT FROM v_turma.curso_id
     OR v_turma.class_school IS DISTINCT FROM p_escola_id
     OR v_turma.session_id IS DISTINCT FROM p_ano_letivo_id
     OR v_turma.ano_letivo IS DISTINCT FROM v_year.ano THEN
    RAISE EXCEPTION 'ENROLLMENT_TURMA_CONTEXT_MISMATCH'
      USING ERRCODE='23514';
  END IF;
  IF p_expected_classe_id IS NOT NULL AND p_expected_classe_id IS DISTINCT FROM v_turma.classe_id THEN
    RAISE EXCEPTION 'ENROLLMENT_CLASS_MISMATCH: selected class differs from official class'
      USING ERRCODE='23514';
  END IF;
  IF p_expected_curso_id IS NOT NULL AND p_expected_curso_id IS DISTINCT FROM v_turma.curso_id THEN
    RAISE EXCEPTION 'ENROLLMENT_COURSE_MISMATCH: selected course differs from official course'
      USING ERRCODE='23514';
  END IF;
  IF lower(coalesce(v_turma.status_validacao,'')) <> 'ativo'
     OR lower(coalesce(v_turma.status_fecho,'')) NOT IN ('aberto','open') THEN
    RAISE EXCEPTION 'ENROLLMENT_TURMA_CLOSED_OR_INACTIVE'
      USING ERRCODE='23514';
  END IF;

  -- Serialize enrollment of this student/year; a duplicate retry returns the same record.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_escola_id::text||':'||p_aluno_id::text||':'||v_year.ano::text,0)
  );
  SELECT * INTO v_existing FROM public.matriculas m
  WHERE m.escola_id=p_escola_id AND m.aluno_id=p_aluno_id AND m.ano_letivo=v_year.ano
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.status='ativo' AND v_existing.ativo
       AND v_existing.turma_id=p_turma_id AND v_existing.session_id=p_ano_letivo_id THEN
      RETURN jsonb_build_object('ok',true,'idempotent',true,'matricula',to_jsonb(v_existing));
    END IF;
    RAISE EXCEPTION 'ENROLLMENT_EXISTING_REVIEW_REQUIRED: use official confirmation, rectification or re-enrollment flow'
      USING ERRCODE='23514';
  END IF;

  IF v_turma.capacidade_maxima IS NOT NULL THEN
    SELECT count(*) INTO v_count FROM public.matriculas m
    WHERE m.escola_id=p_escola_id AND m.turma_id=p_turma_id
       AND m.status='ativo' AND m.ativo;
    IF v_count>=v_turma.capacidade_maxima THEN
      RAISE EXCEPTION 'ENROLLMENT_CLASS_FULL'
        USING ERRCODE='23514';
    END IF;
  END IF;

  -- Same database transaction: number, enrollment, year and student login.
  -- Existing monthly payment generation triggers remain unchanged.
  v_number := public.confirmar_matricula_core(p_aluno_id,v_year.ano,p_turma_id,NULL);
  SELECT * INTO v_result FROM public.matriculas m
  WHERE m.escola_id=p_escola_id AND m.aluno_id=p_aluno_id AND m.ano_letivo=v_year.ano;
  IF NOT FOUND OR v_result.status<>'ativo' OR NOT v_result.ativo
     OR v_result.turma_id IS DISTINCT FROM p_turma_id
     OR v_result.session_id IS DISTINCT FROM p_ano_letivo_id
     OR nullif(btrim(v_result.numero_matricula),'') IS NULL THEN
    RAISE EXCEPTION 'ENROLLMENT_TRANSACTION_POSTCONDITION_FAILED'
      USING ERRCODE='23514';
  END IF;
  RETURN jsonb_build_object('ok',true,'idempotent',false,
    'numero_matricula',v_number,'matricula',to_jsonb(v_result));
END;
$rpc$;

REVOKE ALL ON FUNCTION public.matricula_criar_confirmar_por_turma_v1(uuid,uuid,uuid,uuid,uuid,uuid)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.matricula_criar_confirmar_por_turma_v1(uuid,uuid,uuid,uuid,uuid,uuid)
  TO authenticated,service_role;

-- The legacy wrapper omits authorisation and academic context. Only internal
-- service-role jobs may still invoke it; all human requests must use the guarded RPC.
REVOKE EXECUTE ON FUNCTION public.create_or_confirm_matricula(uuid,uuid,integer,uuid)
  FROM PUBLIC,anon,authenticated;
COMMIT;
