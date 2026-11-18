BEGIN;

REVOKE INSERT ON TABLE public.fiscal_documentos_eventos FROM anon, authenticated;

DROP POLICY IF EXISTS fiscal_documentos_eventos_insert ON public.fiscal_documentos_eventos;

CREATE OR REPLACE FUNCTION public.fiscal_prevent_update_emitido()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public','auth','extensions'
AS $bill$
BEGIN
  IF OLD.status IN ('rectificado', 'anulado') THEN
    RAISE EXCEPTION 'IMMUTABILITY: documento fiscal fechado não pode ser alterado';
  END IF;

  IF OLD.status = 'emitido' THEN
    IF (to_jsonb(NEW) - ARRAY['status']::text[])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['status']::text[])
    THEN
      RAISE EXCEPTION 'IMMUTABILITY: apenas transição de status é permitida para documento emitido';
    END IF;

    IF NEW.status NOT IN ('rectificado', 'anulado') THEN
      RAISE EXCEPTION 'IMMUTABILITY: documento emitido só pode transitar para rectificado ou anulado';
    END IF;

    RETURN NEW;
  END IF;

  IF OLD.status = 'pendente_assinatura' THEN
    IF (to_jsonb(NEW) - ARRAY['assinatura_base64','hash_control','canonical_string','status']::text[])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['assinatura_base64','hash_control','canonical_string','status']::text[])
    THEN
      RAISE EXCEPTION 'IMMUTABILITY: documento pendente só pode receber assinatura e finalizar emissão';
    END IF;

    IF NEW.status NOT IN ('pendente_assinatura', 'emitido') THEN
      RAISE EXCEPTION 'IMMUTABILITY: documento pendente só pode transitar para emitido';
    END IF;

    IF NEW.status = 'emitido' AND (
      nullif(trim(coalesce(NEW.assinatura_base64, '')), '') IS NULL
      OR nullif(trim(coalesce(NEW.hash_control, '')), '') IS NULL
      OR nullif(trim(coalesce(NEW.canonical_string, '')), '') IS NULL
    ) THEN
      RAISE EXCEPTION 'IMMUTABILITY: documento não pode ser emitido sem assinatura, hash e canonical string';
    END IF;

    RETURN NEW;
  END IF;

  IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
    RAISE EXCEPTION 'IMMUTABILITY: estado fiscal não permite alteração';
  END IF;

  RETURN NEW;
END;
$bill$;

COMMIT;
