BEGIN;

CREATE OR REPLACE FUNCTION public.fiscal_agt_auto_prepare_on_emit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $bill$
DECLARE
  v_submission_id uuid;
BEGIN
  IF NEW.status <> 'emitido'
     OR OLD.status IS NOT DISTINCT FROM NEW.status
     OR NEW.tipo_documento NOT IN ('FT','FR','FG','GF','NC','ND') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.fiscal_agt_submission_documentos
    WHERE documento_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.fiscal_agt_submissions (
    empresa_id,
    submission_uuid,
    status,
    document_count,
    created_by
  )
  VALUES (
    NEW.empresa_id,
    gen_random_uuid(),
    'prepared',
    1,
    NEW.created_by
  )
  RETURNING id INTO v_submission_id;

  INSERT INTO public.fiscal_agt_submission_documentos (
    empresa_id,
    submission_id,
    documento_id,
    document_no
  )
  VALUES (
    NEW.empresa_id,
    v_submission_id,
    NEW.id,
    NEW.numero_formatado
  );

  RETURN NEW;
END;
$bill$;

DROP TRIGGER IF EXISTS trg_fiscal_agt_auto_prepare_on_emit
ON public.fiscal_documentos;

CREATE TRIGGER trg_fiscal_agt_auto_prepare_on_emit
AFTER UPDATE OF status ON public.fiscal_documentos
FOR EACH ROW
WHEN (NEW.status = 'emitido' AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.fiscal_agt_auto_prepare_on_emit();

REVOKE EXECUTE ON FUNCTION public.fiscal_agt_auto_prepare_on_emit()
FROM PUBLIC, anon, authenticated, service_role;

COMMIT;