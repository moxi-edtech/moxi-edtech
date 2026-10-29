-- Curtume 2025/2026 and 2026/2027: close the class metadata gap for all turmas.
-- Include named classes through 13th grade, use immutable tenant slug not school display name.
-- Do NOT modify ano_numero (module/year semantics differ), notes, outcomes, finance or fiscal modules.
BEGIN;
DO $check$
DECLARE n integer; bad integer;
BEGIN
  SELECT count(*) INTO n FROM public.escolas
    WHERE slug='complexo-escolar-privado-advetista-de-curtume';
  IF n<>1 THEN RAISE EXCEPTION 'CURTUME_TENANT_SLUG_NOT_UNIQUE'; END IF;
  SELECT count(*) INTO bad FROM public.turmas t
  JOIN public.escolas e ON e.id=t.escola_id
  JOIN public.classes c ON c.id=t.classe_id AND c.escola_id=t.escola_id
  WHERE e.slug='complexo-escolar-privado-advetista-de-curtume'
    AND t.classe_num IS NOT NULL
    AND t.classe_num IS DISTINCT FROM c.numero;
  IF bad>0 THEN RAISE EXCEPTION 'CURTUME_TURMA_CLASS_CONFLICT: %',bad; END IF;
END
$check$;

UPDATE public.turmas t SET classe_num=c.numero
FROM public.classes c JOIN public.escolas e ON e.id=c.escola_id
WHERE e.slug='complexo-escolar-privado-advetista-de-curtume'
  AND t.escola_id=c.escola_id AND t.classe_id=c.id
  AND c.numero IS NOT NULL AND t.classe_num IS NULL;

CREATE OR REPLACE FUNCTION public.curtume_normalize_class_metadata_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $class$
DECLARE v_school uuid; v_num integer;
BEGIN
  SELECT id INTO v_school FROM public.escolas
  WHERE slug='complexo-escolar-privado-advetista-de-curtume';
  IF NEW.escola_id IS DISTINCT FROM v_school THEN RETURN NEW; END IF;
  IF NEW.nome ~ '^([1-9]|1[0-3])ª Classe$' THEN
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
REVOKE ALL ON FUNCTION public.curtume_normalize_class_metadata_v1() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.curtume_normalize_turma_classe_num_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $turma$
DECLARE v_school uuid; v_num integer; v_nome text;
BEGIN
  SELECT id INTO v_school FROM public.escolas
  WHERE slug='complexo-escolar-privado-advetista-de-curtume';
  IF NEW.escola_id IS DISTINCT FROM v_school THEN RETURN NEW; END IF;
  IF NEW.classe_id IS NULL THEN RETURN NEW; END IF;
  SELECT c.numero,c.nome INTO v_num,v_nome FROM public.classes c
  WHERE c.id=NEW.classe_id AND c.escola_id=NEW.escola_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TURMA_CLASS_NOT_IN_SCHOOL' USING ERRCODE='23514';
  END IF;
  IF v_num IS NOT NULL THEN
    IF NEW.classe_num IS NOT NULL AND NEW.classe_num<>v_num THEN
      RAISE EXCEPTION 'TURMA_CLASS_NUMBER_CONFLICT' USING ERRCODE='23514';
    END IF;
    NEW.classe_num:=v_num;
  ELSIF v_nome='Pré-Escolar' THEN
    IF NEW.classe_num IS NOT NULL THEN
      RAISE EXCEPTION 'TURMA_PRESCHOOL_NOT_NUMERIC' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END
$turma$;
REVOKE ALL ON FUNCTION public.curtume_normalize_turma_classe_num_v1() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_curtume_normalize_turma_classe_num ON public.turmas;
CREATE TRIGGER trg_curtume_normalize_turma_classe_num
BEFORE INSERT OR UPDATE OF classe_id,classe_num,escola_id
ON public.turmas FOR EACH ROW EXECUTE FUNCTION public.curtume_normalize_turma_classe_num_v1();
COMMIT;
