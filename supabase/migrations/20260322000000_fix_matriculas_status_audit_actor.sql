BEGIN;

CREATE OR REPLACE FUNCTION public.trg_matriculas_status_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.matriculas_status_audit (
      matricula_id,
      status_anterior,
      status_novo,
      alterado_por,
      origem,
      motivo
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      public.safe_auth_uid(),
      COALESCE(NEW.status_fecho_origem, 'sql_direct'),
      NEW.motivo_fecho
    );
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
