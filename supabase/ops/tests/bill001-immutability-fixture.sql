-- Isolated PG17 fixture. Never run on a KLASSE database.
-- Guard bodies from PR #137, verified byte-for-byte against live pg_proc.prosrc.
\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'bill001_fixture' OR to_regclass('public.fiscal_documentos') IS NOT NULL THEN RAISE EXCEPTION 'DISPOSABLE_FIXTURE_ONLY'; END IF; END $$;
BEGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE TABLE public.fiscal_documentos (
 id integer PRIMARY KEY, empresa_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
 numero_formatado text NOT NULL DEFAULT 'SYNTHETIC', total_bruto_aoa numeric(18,4) NOT NULL DEFAULT 1,
 status text NOT NULL, payload jsonb NOT NULL DEFAULT '{}',
 assinatura_base64 text, hash_control text NOT NULL DEFAULT '', canonical_string text,
 saft_hash text, saft_hash_control integer, saft_hash_anterior text, saft_canonical_string text,
 saft_required boolean NOT NULL DEFAULT false, future_column text
);
ALTER TABLE public.fiscal_documentos ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.fiscal_documentos TO authenticated,service_role;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.fiscal_documentos FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.fiscal_block_document_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public'
AS $$
BEGIN
  RAISE EXCEPTION 'IMMUTABILITY: documento fiscal não pode ser apagado';
END;
$$;
CREATE OR REPLACE FUNCTION public.fiscal_prevent_update_emitido()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'auth', 'extensions'
AS $function$
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
    IF (
      to_jsonb(NEW) -
      ARRAY[
        'assinatura_base64','hash_control','canonical_string',
        'saft_hash','saft_hash_control','saft_hash_anterior',
        'saft_canonical_string','saft_required','status'
      ]::text[]
    ) IS DISTINCT FROM (
      to_jsonb(OLD) -
      ARRAY[
        'assinatura_base64','hash_control','canonical_string',
        'saft_hash','saft_hash_control','saft_hash_anterior',
        'saft_canonical_string','saft_required','status'
      ]::text[]
    ) THEN
      RAISE EXCEPTION 'IMMUTABILITY: documento pendente só pode receber assinaturas e finalizar emissão';
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

    IF NEW.status = 'emitido'
       AND NEW.saft_required
       AND (
         nullif(trim(coalesce(NEW.saft_hash, '')), '') IS NULL
         OR NEW.saft_hash_control IS NULL
         OR nullif(trim(coalesce(NEW.saft_canonical_string, '')), '') IS NULL
       ) THEN
      RAISE EXCEPTION 'IMMUTABILITY: documento SAF-T v2 não pode ser emitido sem assinatura SAF-T';
    END IF;

    RETURN NEW;
  END IF;

  IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
    RAISE EXCEPTION 'IMMUTABILITY: estado fiscal não permite alteração';
  END IF;
  RETURN NEW;
END;
$function$;
-- Pending-on-insert gate reproduced from observed simple live guard. No live data.
CREATE FUNCTION public.fiscal_require_pending_on_insert() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'pg_catalog','public' AS $$
BEGIN
 IF NEW.status IS DISTINCT FROM 'pendente_assinatura' THEN
  RAISE EXCEPTION 'IMMUTABILITY: novo documento fiscal deve iniciar em pendente_assinatura';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER trg_fiscal_documentos_no_delete BEFORE DELETE ON public.fiscal_documentos FOR EACH ROW EXECUTE FUNCTION public.fiscal_block_document_delete();
CREATE TRIGGER trg_fiscal_documentos_no_update BEFORE UPDATE ON public.fiscal_documentos FOR EACH ROW EXECUTE FUNCTION public.fiscal_prevent_update_emitido();
CREATE TRIGGER trg_fiscal_documentos_require_pending_insert BEFORE INSERT ON public.fiscal_documentos FOR EACH ROW EXECUTE FUNCTION public.fiscal_require_pending_on_insert();
CREATE FUNCTION public.assert_immutable(q text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
 BEGIN EXECUTE q;
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'IMMUTABILITY:%' THEN RETURN; END IF;
  RAISE;
 END;
 RAISE EXCEPTION 'EXPECTED_IMMUTABILITY_DENIAL: %',q;
END;
$$;
CREATE FUNCTION public.assert_denied(q text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
 BEGIN EXECUTE q;
 EXCEPTION WHEN insufficient_privilege THEN RETURN;
 END;
 RAISE EXCEPTION 'EXPECTED_ACL_DENIAL: %',q;
END;
$$;
GRANT EXECUTE ON FUNCTION public.assert_denied(text) TO anon,authenticated,service_role;
-- Check actual historical function body digests; a mutated fixture fails.
DO $$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.fiscal_block_document_delete()'::regprocedure) <> 'eb50ed3256fdbf0463f0ae7a94dc6e70' OR
    (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.fiscal_prevent_update_emitido()'::regprocedure) <> '45fd67275fed155bfb06a9360958bff1' THEN
  RAISE EXCEPTION 'GUARD_BODY_DRIFT';
 END IF;
END $$;
SELECT public.assert_immutable($q$INSERT INTO public.fiscal_documentos(id,status) VALUES(99,'emitido')$q$);
INSERT INTO public.fiscal_documentos(id,status) VALUES(1,'pendente_assinatura');
SELECT public.assert_immutable($q$UPDATE public.fiscal_documentos SET total_bruto_aoa=2 WHERE id=1$q$);
SELECT public.assert_immutable($q$UPDATE public.fiscal_documentos SET future_column='x' WHERE id=1$q$);
SELECT public.assert_immutable($q$UPDATE public.fiscal_documentos SET status='emitido' WHERE id=1$q$);
SELECT public.assert_immutable($q$UPDATE public.fiscal_documentos SET status='anulado' WHERE id=1$q$);
UPDATE public.fiscal_documentos SET assinatura_base64='synthetic',hash_control='synthetic',canonical_string='synthetic',status='emitido' WHERE id=1;
SELECT public.assert_immutable($q$UPDATE public.fiscal_documentos SET total_bruto_aoa=2 WHERE id=1$q$);
SELECT public.assert_immutable($q$UPDATE public.fiscal_documentos SET payload='{"tampered":true}' WHERE id=1$q$);
SELECT public.assert_immutable($q$UPDATE public.fiscal_documentos SET future_column='x' WHERE id=1$q$);
SELECT public.assert_immutable($q$UPDATE public.fiscal_documentos SET status='anulado',hash_control='tampered' WHERE id=1$q$);
SELECT public.assert_immutable($q$DELETE FROM public.fiscal_documentos WHERE id=1$q$);
UPDATE public.fiscal_documentos SET status='anulado' WHERE id=1;
SELECT public.assert_immutable($q$UPDATE public.fiscal_documentos SET status='emitido' WHERE id=1$q$);
SELECT public.assert_immutable($q$UPDATE public.fiscal_documentos SET total_bruto_aoa=5 WHERE id=1$q$);
INSERT INTO public.fiscal_documentos(id,status,saft_required) VALUES(2,'pendente_assinatura',true);
SELECT public.assert_immutable($q$UPDATE public.fiscal_documentos SET assinatura_base64='synthetic',hash_control='synthetic',canonical_string='synthetic',status='emitido' WHERE id=2$q$);
UPDATE public.fiscal_documentos SET assinatura_base64='synthetic',hash_control='synthetic',canonical_string='synthetic',saft_hash='synthetic',saft_hash_control=1,saft_canonical_string='synthetic',status='emitido' WHERE id=2;
UPDATE public.fiscal_documentos SET status='rectificado' WHERE id=2;
SELECT public.assert_immutable($q$UPDATE public.fiscal_documentos SET status='emitido' WHERE id=2$q$);
SET LOCAL ROLE anon;
SELECT public.assert_denied($q$INSERT INTO public.fiscal_documentos(id,status) VALUES(10,'pendente_assinatura')$q$);
SELECT public.assert_denied($q$UPDATE public.fiscal_documentos SET total_bruto_aoa=99 WHERE id=1$q$);
SELECT public.assert_denied($q$DELETE FROM public.fiscal_documentos WHERE id=1$q$);
SELECT public.assert_denied($q$TRUNCATE public.fiscal_documentos$q$);
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT public.assert_denied($q$INSERT INTO public.fiscal_documentos(id,status) VALUES(10,'pendente_assinatura')$q$);
SELECT public.assert_denied($q$UPDATE public.fiscal_documentos SET total_bruto_aoa=99 WHERE id=1$q$);
SELECT public.assert_denied($q$DELETE FROM public.fiscal_documentos WHERE id=1$q$);
SELECT public.assert_denied($q$TRUNCATE public.fiscal_documentos$q$);
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT public.assert_denied($q$INSERT INTO public.fiscal_documentos(id,status) VALUES(10,'pendente_assinatura')$q$);
SELECT public.assert_denied($q$UPDATE public.fiscal_documentos SET total_bruto_aoa=99 WHERE id=1$q$);
SELECT public.assert_denied($q$DELETE FROM public.fiscal_documentos WHERE id=1$q$);
SELECT public.assert_denied($q$TRUNCATE public.fiscal_documentos$q$);
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.fiscal_documentos) <> 2 OR
 NOT EXISTS (SELECT 1 FROM public.fiscal_documentos WHERE id=1 AND status='anulado' AND total_bruto_aoa=1 AND future_column IS NULL) OR
 NOT EXISTS (SELECT 1 FROM public.fiscal_documentos WHERE id=2 AND status='rectificado' AND saft_required) THEN
 RAISE EXCEPTION 'FIXTURE_STATE_CORRUPTED';
 END IF;
END $$;
ROLLBACK;
\echo BILL-001 fixture PASS (not full production schema or AGT homologation)
