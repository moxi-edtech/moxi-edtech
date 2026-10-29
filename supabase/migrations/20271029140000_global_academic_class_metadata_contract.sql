-- KLASSE | Global class/course metadata integrity for every academic installation path.
-- Applies to administrator configuration, curriculum presets and onboarding RPCs.
-- Historical gradebooks, decisions, enrollments and finance/fiscal modules untouched.
BEGIN;

CREATE OR REPLACE FUNCTION public.klasse_class_number_from_name_v1(p_nome text)
RETURNS integer
LANGUAGE sql IMMUTABLE STRICT
SET search_path TO 'pg_catalog'
AS $parse$
  SELECT CASE
    WHEN btrim(p_nome) ~* '^([1-9]|1[0-3])[ªº]?[[:space:]]*(classe|ano)$'
      THEN substring(btrim(p_nome) from '^([0-9]+)')::integer
    ELSE NULL
  END;
$parse$;

-- Preflight: do not overwrite existing explicit values or move classes between courses.
DO $preflight$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.classes c
  WHERE public.klasse_class_number_from_name_v1(c.nome) IS NOT NULL
    AND ((c.numero IS NOT NULL
           AND c.numero<>public.klasse_class_number_from_name_v1(c.nome))
      OR (coalesce(c.ordem,0) NOT IN
           (0,public.klasse_class_number_from_name_v1(c.nome))));
  IF v_count>0 THEN
    RAISE EXCEPTION 'CLASS_METADATA_CONFLICT: % explicit values must be reviewed',v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.classes c
  WHERE c.curso_id IS NOT NULL
    AND NOT EXISTS(SELECT 1 FROM public.cursos cu
       WHERE cu.id=c.curso_id AND cu.escola_id=c.escola_id);
  IF v_count>0 THEN
    RAISE EXCEPTION 'CLASS_COURSE_TENANT_CONFLICT: %',v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.turmas t
  JOIN public.classes c ON c.id=t.classe_id
  WHERE c.escola_id IS DISTINCT FROM t.escola_id
     OR (c.curso_id IS NOT NULL AND t.curso_id IS NOT NULL
         AND c.curso_id IS DISTINCT FROM t.curso_id)
     OR (c.numero IS NOT NULL AND t.classe_num IS NOT NULL
         AND t.classe_num IS DISTINCT FROM c.numero);
  IF v_count>0 THEN
    RAISE EXCEPTION 'TURMA_CLASS_BINDING_CONFLICT: %',v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.curso_matriz cm
  JOIN public.classes c ON c.id=cm.classe_id
  WHERE cm.escola_id IS DISTINCT FROM c.escola_id
     OR cm.curso_id IS DISTINCT FROM c.curso_id;
  IF v_count>0 THEN
    RAISE EXCEPTION 'MATRIX_CLASS_BINDING_CONFLICT: %',v_count;
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.klasse_guard_class_identity_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $guard$
DECLARE v_grade integer;
BEGIN
  IF NEW.curso_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cursos cu WHERE cu.id=NEW.curso_id
      AND cu.escola_id=NEW.escola_id
  ) THEN
    RAISE EXCEPTION 'CLASS_COURSE_TENANT_MISMATCH: course outside this school'
      USING ERRCODE='23514';
  END IF;
  IF NEW.ano_letivo_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.anos_letivos al WHERE al.id=NEW.ano_letivo_id
      AND al.escola_id=NEW.escola_id
  ) THEN
    RAISE EXCEPTION 'CLASS_ACADEMIC_YEAR_TENANT_MISMATCH'
      USING ERRCODE='23514';
  END IF;

  IF TG_OP='UPDATE' AND NEW.curso_id IS DISTINCT FROM OLD.curso_id
     AND (EXISTS(SELECT 1 FROM public.turmas t WHERE t.classe_id=OLD.id)
      OR EXISTS(SELECT 1 FROM public.curso_matriz cm WHERE cm.classe_id=OLD.id)
      OR EXISTS(SELECT 1 FROM public.curso_curriculos cc WHERE cc.classe_id=OLD.id)) THEN
    RAISE EXCEPTION 'CLASS_COURSE_REASSIGNMENT_REQUIRES_MIGRATION'
      USING ERRCODE='23514';
  END IF;

  v_grade:=public.klasse_class_number_from_name_v1(NEW.nome);
  IF v_grade IS NOT NULL THEN
    IF NEW.curso_id IS NULL THEN
      RAISE EXCEPTION 'CLASS_COURSE_REQUIRED: numbered class must belong to a course'
        USING ERRCODE='23514';
    END IF;
    IF NEW.numero IS NOT NULL AND NEW.numero<>v_grade THEN
      RAISE EXCEPTION 'CLASS_NUMBER_CONFLICT: class name contradicts numero'
        USING ERRCODE='23514';
    END IF;
    -- Legacy admin forms may send a menu position instead of a grade level.
    -- Normalize it rather than breaking course installation before the new UI deploy.
    NEW.numero:=v_grade;
    NEW.ordem:=v_grade;
  ELSIF NEW.nome ~* '^pré[-[:space:]]*escolar$' THEN
    IF NEW.numero IS NOT NULL THEN
      RAISE EXCEPTION 'PRESCHOOL_NOT_NUMERIC: number must be null'
        USING ERRCODE='23514';
    END IF;
    IF NEW.ordem IS NOT NULL AND NEW.ordem<>0 THEN
      RAISE EXCEPTION 'PRESCHOOL_ORDER_CONFLICT'
        USING ERRCODE='23514';
    END IF;
    NEW.ordem:=0;
  END IF;
  RETURN NEW;
END;
$guard$;

REVOKE ALL ON FUNCTION public.klasse_guard_class_identity_v1()
FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_klasse_guard_class_identity ON public.classes;
CREATE TRIGGER trg_klasse_guard_class_identity
BEFORE INSERT OR UPDATE OF nome,numero,ordem,curso_id,escola_id,ano_letivo_id
ON public.classes FOR EACH ROW
EXECUTE FUNCTION public.klasse_guard_class_identity_v1();

CREATE OR REPLACE FUNCTION public.klasse_guard_turma_class_binding_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $guard$
DECLARE v_class public.classes%ROWTYPE;
BEGIN
  IF NEW.classe_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_class FROM public.classes WHERE id=NEW.classe_id;
  IF NOT FOUND OR v_class.escola_id IS DISTINCT FROM NEW.escola_id THEN
    RAISE EXCEPTION 'TURMA_CLASS_TENANT_MISMATCH'
      USING ERRCODE='23514';
  END IF;
  IF v_class.curso_id IS NULL THEN
    RAISE EXCEPTION 'TURMA_CLASS_COURSE_REQUIRED'
      USING ERRCODE='23514';
  END IF;
  IF NEW.curso_id IS NULL THEN
    NEW.curso_id:=v_class.curso_id;
  ELSIF NEW.curso_id IS DISTINCT FROM v_class.curso_id THEN
    RAISE EXCEPTION 'TURMA_CLASS_COURSE_MISMATCH'
      USING ERRCODE='23514';
  END IF;
  IF v_class.numero IS NOT NULL THEN
    IF NEW.classe_num IS NOT NULL AND NEW.classe_num<>v_class.numero THEN
      RAISE EXCEPTION 'TURMA_CLASS_NUMBER_MISMATCH'
        USING ERRCODE='23514';
    END IF;
    NEW.classe_num:=v_class.numero;
  ELSIF v_class.nome ~* '^pré[-[:space:]]*escolar$'
        AND NEW.classe_num IS NOT NULL THEN
    RAISE EXCEPTION 'PRESCHOOL_TURMA_NOT_NUMERIC'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$guard$;
REVOKE ALL ON FUNCTION public.klasse_guard_turma_class_binding_v1()
FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_klasse_guard_turma_class_binding ON public.turmas;
CREATE TRIGGER trg_klasse_guard_turma_class_binding
BEFORE INSERT OR UPDATE OF classe_id,classe_num,curso_id,escola_id
ON public.turmas FOR EACH ROW
EXECUTE FUNCTION public.klasse_guard_turma_class_binding_v1();

-- The old per-school numeric guards are now superseded by equivalent global
-- normalization; keeping both would reject legacy admin requests before the
-- canonical trigger can replace an arbitrary menu order.
DROP TRIGGER IF EXISTS trg_curtume_normalize_class_metadata ON public.classes;
DROP TRIGGER IF EXISTS trg_curtume_normalize_turma_classe_num ON public.turmas;

-- Enforce the same tenant/course/class reference in both curriculum layouts.
-- Null classe_id is permitted on legacy course-wide curriculum drafts.
CREATE OR REPLACE FUNCTION public.klasse_guard_curriculum_class_binding_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $guard$
DECLARE v_class public.classes%ROWTYPE;
DECLARE v_curriculo public.curso_curriculos%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.cursos c
                 WHERE c.id=NEW.curso_id AND c.escola_id=NEW.escola_id) THEN
    RAISE EXCEPTION 'CURRICULUM_COURSE_TENANT_MISMATCH'
      USING ERRCODE='23514';
  END IF;
  IF NEW.classe_id IS NOT NULL THEN
    SELECT * INTO v_class FROM public.classes WHERE id=NEW.classe_id;
    IF NOT FOUND OR v_class.escola_id IS DISTINCT FROM NEW.escola_id
       OR v_class.curso_id IS DISTINCT FROM NEW.curso_id THEN
      RAISE EXCEPTION 'CURRICULUM_CLASS_BINDING_MISMATCH'
        USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_TABLE_NAME='curso_matriz' AND NEW.curso_curriculo_id IS NOT NULL THEN
    SELECT * INTO v_curriculo FROM public.curso_curriculos
      WHERE id=NEW.curso_curriculo_id;
    IF NOT FOUND OR v_curriculo.escola_id IS DISTINCT FROM NEW.escola_id
       OR v_curriculo.curso_id IS DISTINCT FROM NEW.curso_id
       OR (v_curriculo.classe_id IS NOT NULL
           AND v_curriculo.classe_id IS DISTINCT FROM NEW.classe_id) THEN
      RAISE EXCEPTION 'MATRIX_CURRICULUM_BINDING_MISMATCH'
        USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$guard$;
REVOKE ALL ON FUNCTION public.klasse_guard_curriculum_class_binding_v1()
FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_klasse_guard_curso_matriz_binding ON public.curso_matriz;
CREATE TRIGGER trg_klasse_guard_curso_matriz_binding
BEFORE INSERT OR UPDATE OF escola_id,curso_id,classe_id,curso_curriculo_id
ON public.curso_matriz FOR EACH ROW
EXECUTE FUNCTION public.klasse_guard_curriculum_class_binding_v1();
DROP TRIGGER IF EXISTS trg_klasse_guard_curso_curriculos_binding ON public.curso_curriculos;
CREATE TRIGGER trg_klasse_guard_curso_curriculos_binding
BEFORE INSERT OR UPDATE OF escola_id,curso_id,classe_id
ON public.curso_curriculos FOR EACH ROW
EXECUTE FUNCTION public.klasse_guard_curriculum_class_binding_v1();

-- Deterministic backfill only for class names that unambiguously denote grades.
UPDATE public.classes c
SET numero=public.klasse_class_number_from_name_v1(c.nome),
    ordem=public.klasse_class_number_from_name_v1(c.nome)
WHERE public.klasse_class_number_from_name_v1(c.nome) IS NOT NULL
  AND (c.numero IS DISTINCT FROM public.klasse_class_number_from_name_v1(c.nome)
       OR c.ordem IS DISTINCT FROM public.klasse_class_number_from_name_v1(c.nome));

UPDATE public.turmas t
SET classe_num=c.numero
FROM public.classes c
WHERE c.id=t.classe_id
  AND c.escola_id=t.escola_id
  AND c.numero IS NOT NULL
  AND t.classe_num IS NULL;

-- Invariant postflight: do not silently finalize an inconsistent installation.
DO $postflight$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.classes c
  WHERE public.klasse_class_number_from_name_v1(c.nome) IS NOT NULL
    AND (c.numero IS DISTINCT FROM public.klasse_class_number_from_name_v1(c.nome)
      OR c.ordem IS DISTINCT FROM public.klasse_class_number_from_name_v1(c.nome));
  IF v_count<>0 THEN RAISE EXCEPTION 'CLASS_METADATA_STILL_INVALID: %',v_count; END IF;
  SELECT count(*) INTO v_count FROM public.turmas t
  JOIN public.classes c ON c.id=t.classe_id
  WHERE c.escola_id<>t.escola_id
     OR (c.curso_id IS NOT NULL AND t.curso_id IS DISTINCT FROM c.curso_id)
     OR (c.numero IS NOT NULL AND t.classe_num IS DISTINCT FROM c.numero);
  IF v_count<>0 THEN RAISE EXCEPTION 'TURMA_BINDING_STILL_INVALID: %',v_count; END IF;
END;
$postflight$;
COMMIT;
