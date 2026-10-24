-- PostgreSQL 17 disposable-only fixture. No production data.
\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE TABLE public.fiscal_documentos(id uuid);
CREATE TABLE public.fiscal_documento_itens(id uuid);
CREATE TABLE public.fiscal_documentos_eventos(id uuid);
CREATE TABLE public.fiscal_series(id uuid, ultimo_numero bigint);
CREATE TABLE public.fiscal_tax_profiles(id uuid, code text, valid_to date);
CREATE TABLE public.financeiro_itens(id uuid, tax_profile_code text);
CREATE TABLE public.financeiro_tabelas(id uuid, tax_profile_code text);
ALTER TABLE public.fiscal_tax_profiles ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX ux_fiscal_tax_profiles_open_code ON public.fiscal_tax_profiles(code) WHERE valid_to IS NULL;
CREATE INDEX idx_financeiro_itens_tax_profile ON public.financeiro_itens(tax_profile_code);
CREATE INDEX idx_financeiro_tabelas_tax_profile ON public.financeiro_tabelas(tax_profile_code);
CREATE FUNCTION public.fiscal_block_document_delete() RETURNS trigger LANGUAGE plpgsql AS
  $$BEGIN RAISE EXCEPTION 'synthetic fiscal write forbidden'; END$$;
CREATE FUNCTION public.fiscal_block_item_mutation() RETURNS trigger LANGUAGE plpgsql AS
  $$BEGIN RAISE EXCEPTION 'synthetic fiscal write forbidden'; END$$;
CREATE FUNCTION public.fiscal_block_event_mutation() RETURNS trigger LANGUAGE plpgsql AS
  $$BEGIN RAISE EXCEPTION 'synthetic fiscal write forbidden'; END$$;
CREATE FUNCTION public.fiscal_guard_series_counter() RETURNS trigger LANGUAGE plpgsql AS
  $$BEGIN RAISE EXCEPTION 'synthetic fiscal counter forbidden'; END$$;
CREATE FUNCTION public.fiscal_require_pending_on_insert() RETURNS trigger LANGUAGE plpgsql AS
  $$BEGIN RAISE EXCEPTION 'synthetic fiscal write forbidden'; END$$;
CREATE FUNCTION public.fiscal_reservar_numero_serie(uuid) RETURNS bigint
  LANGUAGE sql AS $$SELECT 0::bigint$$;
CREATE FUNCTION public.fiscal_finalizar_assinatura(uuid,text,text,text) RETURNS void
  LANGUAGE sql AS $$SELECT NULL::void$$;
REVOKE ALL ON FUNCTION public.fiscal_reservar_numero_serie(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fiscal_finalizar_assinatura(uuid,text,text,text) FROM PUBLIC;
CREATE TRIGGER trg_fiscal_documentos_no_delete
 BEFORE DELETE ON public.fiscal_documentos
 FOR EACH ROW EXECUTE FUNCTION public.fiscal_block_document_delete();
CREATE TRIGGER trg_fiscal_documento_itens_no_mutation
 BEFORE UPDATE OR DELETE ON public.fiscal_documento_itens
 FOR EACH ROW EXECUTE FUNCTION public.fiscal_block_item_mutation();
CREATE TRIGGER trg_fiscal_documentos_eventos_no_mutation
 BEFORE UPDATE OR DELETE ON public.fiscal_documentos_eventos
 FOR EACH ROW EXECUTE FUNCTION public.fiscal_block_event_mutation();
CREATE TRIGGER trg_fiscal_documentos_require_pending_insert
 BEFORE INSERT ON public.fiscal_documentos
 FOR EACH ROW EXECUTE FUNCTION public.fiscal_require_pending_on_insert();
-- Deliberately omit series counter trigger; convergence must create it.
COMMIT;
\ir ../../migrations/20270826132000_reconcile_fiscal_guard_catalog.sql
DO $$
BEGIN
  IF (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal
    AND tgname IN (
      'trg_fiscal_documentos_no_delete',
      'trg_fiscal_documento_itens_no_mutation',
      'trg_fiscal_documentos_eventos_no_mutation',
      'trg_fiscal_documentos_require_pending_insert',
      'trg_fiscal_series_counter_guard')) <> 5 THEN
    RAISE EXCEPTION 'missing or duplicate fiscal guard triggers';
  END IF;
  IF has_table_privilege('authenticated','public.fiscal_documentos','UPDATE') THEN
    RAISE EXCEPTION 'unexpected new permission after bridge';
  END IF;
END $$;
-- Re-run: expected NO-OP on existing guards.
\ir ../../migrations/20270826132000_reconcile_fiscal_guard_catalog.sql
DO $$
BEGIN
  IF (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal
     AND tgname='trg_fiscal_series_counter_guard') <> 1 THEN
    RAISE EXCEPTION 'bridge not idempotent';
  END IF;
END $$;
