-- Applied to KLASSE Supabase under 20261028211433; mirrored from migration history.
CREATE OR REPLACE FUNCTION public.lifecycle_sync_matricula_ativo()
RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $lifecycle_sync$
BEGIN
  -- A flag diz exclusivamente se a matrícula está operacionalmente ativa.
  -- O significado académico de aprovado/reprovado é independente.
  NEW.ativo := public.canonicalize_matricula_status_text(NEW.status) = 'ativo';
  RETURN NEW;
END;
$lifecycle_sync$;

DROP TRIGGER IF EXISTS trg_zzz_lifecycle_sync_matricula_ativo ON public.matriculas;
CREATE TRIGGER trg_zzz_lifecycle_sync_matricula_ativo
BEFORE INSERT OR UPDATE OF status, ativo ON public.matriculas
FOR EACH ROW EXECUTE FUNCTION public.lifecycle_sync_matricula_ativo();

ALTER TABLE public.matriculas ALTER COLUMN ativo SET DEFAULT false;
ALTER TABLE public.matriculas ALTER COLUMN ativo SET NOT NULL;
ALTER TABLE public.matriculas ADD CONSTRAINT chk_lifecycle_status_ativo_consistente
CHECK ((status = 'ativo') = ativo) NOT VALID;
ALTER TABLE public.matriculas VALIDATE CONSTRAINT chk_lifecycle_status_ativo_consistente;
