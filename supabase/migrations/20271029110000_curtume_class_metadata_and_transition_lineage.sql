-- Curtume: repair numeric class metadata and protect transition lineage.
-- No grades, academic results, historic snapshots or financial/fiscal tables are changed.
BEGIN;
DO $preflight$
DECLARE v_count integer; v_invalid integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.escolas
  WHERE nome='COMPLEXO ESCOLAR PRIVADO ADVETISTA DE CURTUME';
  IF v_count<>1 THEN RAISE EXCEPTION 'CURTUME_SCHOOL_NOT_UNIQUE'; END IF;
  SELECT count(*) INTO v_count FROM public.classes c JOIN public.escolas e ON e.id=c.escola_id
  WHERE e.nome='COMPLEXO ESCOLAR PRIVADO ADVETISTA DE CURTUME';
  IF v_count<>10 THEN RAISE EXCEPTION 'CURTUME_CLASS_COUNT_UNEXPECTED: %',v_count; END IF;
  SELECT count(*) INTO v_invalid
  FROM public.classes c JOIN public.escolas e ON e.id=c.escola_id
  WHERE e.nome='COMPLEXO ESCOLAR PRIVADO ADVETISTA DE CURTUME'
  AND NOT (
    (c.nome='Pré-Escolar' AND c.numero IS NULL AND coalesce(c.ordem,0)=0)
    OR (c.nome ~ '^[1-9]ª Classe$'
      AND (c.numero IS NULL OR c.numero=substring(c.nome from '^[0-9]+')::integer)
      AND coalesce(c.ordem,0) IN (0,substring(c.nome from '^[0-9]+')::integer))
  );
  IF v_invalid<>0 THEN RAISE EXCEPTION 'CURTUME_CLASS_MAPPING_CONFLICT: %',v_invalid; END IF;
  IF EXISTS (
    SELECT 1 FROM public.matriculas d JOIN public.matriculas o ON o.id=d.origem_transicao_matricula_id
    WHERE d.origem_transicao_matricula_id IS NOT NULL AND
      (d.escola_id IS DISTINCT FROM o.escola_id
       OR d.aluno_id IS DISTINCT FROM o.aluno_id
       OR d.ano_letivo IS DISTINCT FROM o.ano_letivo+1)
  ) THEN RAISE EXCEPTION 'TRANSITION_LINEAGE_EXISTING_CONFLICT'; END IF;
END
$preflight$;

UPDATE public.classes c SET
  numero=substring(c.nome from '^[0-9]+')::integer,
  ordem=substring(c.nome from '^[0-9]+')::integer
FROM public.escolas e
WHERE c.escola_id=e.id
  AND e.nome='COMPLEXO ESCOLAR PRIVADO ADVETISTA DE CURTUME'
  AND c.nome ~ '^[1-9]ª Classe$'
  AND (c.numero IS DISTINCT FROM substring(c.nome from '^[0-9]+')::integer
       OR c.ordem IS DISTINCT FROM substring(c.nome from '^[0-9]+')::integer);

CREATE OR REPLACE FUNCTION public.curtume_normalize_class_metadata_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'pg_catalog','public'
AS $class$
DECLARE v_school uuid; v_num integer;
BEGIN
  SELECT id INTO v_school FROM public.escolas
  WHERE nome='COMPLEXO ESCOLAR PRIVADO ADVETISTA DE CURTUME';
  IF NEW.escola_id IS DISTINCT FROM v_school THEN RETURN NEW; END IF;
  IF NEW.nome ~ '^[1-9]ª Classe$' THEN
    v_num:=substring(NEW.nome from '^[0-9]+')::integer;
    IF NEW.numero IS NOT NULL AND NEW.numero<>v_num THEN
      RAISE EXCEPTION 'CLASS_NUMBER_CONFLICT' USING ERRCODE='23514';
    END IF;
    IF NEW.ordem IS NOT NULL AND NEW.ordem NOT IN (0,v_num) THEN
      RAISE EXCEPTION 'CLASS_ORDER_CONFLICT' USING ERRCODE='23514';
    END IF;
    NEW.numero:=v_num;
    NEW.ordem:=v_num;
  ELSIF NEW.nome='Pré-Escolar' THEN
    IF NEW.numero IS NOT NULL OR coalesce(NEW.ordem,0)<>0 THEN
      RAISE EXCEPTION 'PRESCHOOL_METADATA_CONFLICT' USING ERRCODE='23514';
    END IF;
    NEW.ordem:=0;
  END IF;
  RETURN NEW;
END
$class$;
DROP TRIGGER IF EXISTS trg_curtume_normalize_class_metadata ON public.classes;
CREATE TRIGGER trg_curtume_normalize_class_metadata
BEFORE INSERT OR UPDATE OF nome,numero,ordem,escola_id ON public.classes
FOR EACH ROW EXECUTE FUNCTION public.curtume_normalize_class_metadata_v1();

CREATE OR REPLACE FUNCTION public.guard_matricula_transition_lineage_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'pg_catalog','public'
AS $lineage$
DECLARE v_source public.matriculas%ROWTYPE;
BEGIN
  IF NEW.origem_transicao_matricula_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_source FROM public.matriculas
  WHERE id=NEW.origem_transicao_matricula_id;
  IF NOT FOUND OR v_source.escola_id IS DISTINCT FROM NEW.escola_id
     OR v_source.aluno_id IS DISTINCT FROM NEW.aluno_id
     OR v_source.ano_letivo IS NULL OR NEW.ano_letivo IS NULL
     OR NEW.ano_letivo<>v_source.ano_letivo+1 OR v_source.id=NEW.id THEN
    RAISE EXCEPTION 'INVALID_TRANSITION_LINEAGE' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$lineage$;
DROP TRIGGER IF EXISTS trg_guard_matricula_transition_lineage ON public.matriculas;
CREATE TRIGGER trg_guard_matricula_transition_lineage
BEFORE INSERT OR UPDATE OF origem_transicao_matricula_id,escola_id,aluno_id,ano_letivo
ON public.matriculas FOR EACH ROW
EXECUTE FUNCTION public.guard_matricula_transition_lineage_v1();
COMMIT;
