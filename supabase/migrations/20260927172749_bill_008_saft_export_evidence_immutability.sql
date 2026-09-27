BEGIN;

CREATE OR REPLACE FUNCTION public.fiscal_saft_exports_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public'
AS $bill$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'IMMUTABILITY: evidência SAF-T não pode ser apagada';
  END IF;

  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
     OR NEW.periodo_inicio IS DISTINCT FROM OLD.periodo_inicio
     OR NEW.periodo_fim IS DISTINCT FROM OLD.periodo_fim
     OR NEW.xsd_version IS DISTINCT FROM OLD.xsd_version
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'IMMUTABILITY: identidade/período da exportação SAF-T não pode ser alterado';
  END IF;

  IF OLD.status = 'validated'
     AND to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
    RAISE EXCEPTION 'IMMUTABILITY: exportação SAF-T validada é imutável';
  END IF;

  RETURN NEW;
END;
$bill$;

DROP TRIGGER IF EXISTS trg_fiscal_saft_exports_guard
ON public.fiscal_saft_exports;

CREATE TRIGGER trg_fiscal_saft_exports_guard
BEFORE UPDATE OR DELETE ON public.fiscal_saft_exports
FOR EACH ROW EXECUTE FUNCTION public.fiscal_saft_exports_guard();

DROP POLICY IF EXISTS fiscal_saft_exports_update
ON public.fiscal_saft_exports;
DROP POLICY IF EXISTS fiscal_saft_exports_delete
ON public.fiscal_saft_exports;

REVOKE ALL ON TABLE public.fiscal_saft_exports
FROM anon;

REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.fiscal_saft_exports
FROM authenticated;

GRANT SELECT, INSERT
ON TABLE public.fiscal_saft_exports
TO authenticated;

REVOKE DELETE, TRUNCATE
ON TABLE public.fiscal_saft_exports
FROM service_role;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.fiscal_saft_exports
TO service_role;

REVOKE EXECUTE ON FUNCTION public.fiscal_saft_exports_guard()
FROM PUBLIC, anon, authenticated, service_role;

COMMIT;