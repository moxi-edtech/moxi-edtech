-- Additive fiscal guard convergence, prepared for review only. DO NOT deploy
-- before all historical migrations/duplicate versions have been reconciled.
-- Does not alter any existing fiscal function, policy, RLS or ACL.
-- The canonical historical BILL migrations are also restored in this PR,
-- at their original versions. This late bridge is an invariant backstop.
BEGIN;
SET LOCAL search_path = pg_catalog, public;

DO $guard$
DECLARE
  v_table text;
  v_role text;
  v_rec record;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'fiscal_documentos', 'fiscal_documento_itens',
    'fiscal_documentos_eventos', 'fiscal_series', 'fiscal_tax_profiles'
  ] LOOP
    IF to_regclass('public.' || v_table) IS NULL THEN
      RAISE EXCEPTION 'BILL guard dependency missing: %; restore the historical fiscal migration first',
        v_table;
    END IF;
  END LOOP;

  IF to_regprocedure('public.fiscal_block_document_delete()') IS NULL
     OR to_regprocedure('public.fiscal_block_item_mutation()') IS NULL
     OR to_regprocedure('public.fiscal_block_event_mutation()') IS NULL
     OR to_regprocedure('public.fiscal_guard_series_counter()') IS NULL
     OR to_regprocedure('public.fiscal_require_pending_on_insert()') IS NULL THEN
    RAISE EXCEPTION 'BILL-001/003 guard functions absent: historical fiscal migration incomplete';
  END IF;

  -- CREATE TRIGGER has no IF NOT EXISTS on PostgreSQL 17. A catalog gate is
  -- the equivalent, and leaves existing production triggers entirely intact.
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.fiscal_documentos'::regclass
       AND tgname = 'trg_fiscal_documentos_no_delete' AND NOT tgisinternal) THEN
    CREATE TRIGGER trg_fiscal_documentos_no_delete
      BEFORE DELETE ON public.fiscal_documentos
      FOR EACH ROW EXECUTE FUNCTION public.fiscal_block_document_delete();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.fiscal_documento_itens'::regclass
       AND tgname = 'trg_fiscal_documento_itens_no_mutation' AND NOT tgisinternal) THEN
    CREATE TRIGGER trg_fiscal_documento_itens_no_mutation
      BEFORE UPDATE OR DELETE ON public.fiscal_documento_itens
      FOR EACH ROW EXECUTE FUNCTION public.fiscal_block_item_mutation();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.fiscal_documentos_eventos'::regclass
       AND tgname = 'trg_fiscal_documentos_eventos_no_mutation' AND NOT tgisinternal) THEN
    CREATE TRIGGER trg_fiscal_documentos_eventos_no_mutation
      BEFORE UPDATE OR DELETE ON public.fiscal_documentos_eventos
      FOR EACH ROW EXECUTE FUNCTION public.fiscal_block_event_mutation();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.fiscal_series'::regclass
       AND tgname = 'trg_fiscal_series_counter_guard' AND NOT tgisinternal) THEN
    CREATE TRIGGER trg_fiscal_series_counter_guard
      BEFORE UPDATE OF ultimo_numero ON public.fiscal_series
      FOR EACH ROW EXECUTE FUNCTION public.fiscal_guard_series_counter();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.fiscal_documentos'::regclass
       AND tgname = 'trg_fiscal_documentos_require_pending_insert' AND NOT tgisinternal) THEN
    CREATE TRIGGER trg_fiscal_documentos_require_pending_insert
      BEFORE INSERT ON public.fiscal_documentos
      FOR EACH ROW EXECUTE FUNCTION public.fiscal_require_pending_on_insert();
  END IF;

  -- Never accept a same-named trigger wired to a different implementation.
  FOR v_rec IN
    SELECT t.tgname, pg_get_triggerdef(t.oid, true) AS actual
    FROM pg_trigger t
    WHERE NOT t.tgisinternal AND t.tgname IN (
      'trg_fiscal_documentos_no_delete',
      'trg_fiscal_documento_itens_no_mutation',
      'trg_fiscal_documentos_eventos_no_mutation',
      'trg_fiscal_series_counter_guard',
      'trg_fiscal_documentos_require_pending_insert'
    )
  LOOP
    IF NOT (
      (v_rec.tgname = 'trg_fiscal_documentos_no_delete' AND
        v_rec.actual ILIKE '%fiscal_block_document_delete()%')
      OR (v_rec.tgname = 'trg_fiscal_documento_itens_no_mutation' AND
        v_rec.actual ILIKE '%fiscal_block_item_mutation()%')
      OR (v_rec.tgname = 'trg_fiscal_documentos_eventos_no_mutation' AND
        v_rec.actual ILIKE '%fiscal_block_event_mutation()%')
      OR (v_rec.tgname = 'trg_fiscal_series_counter_guard' AND
        v_rec.actual ILIKE '%fiscal_guard_series_counter()%')
      OR (v_rec.tgname = 'trg_fiscal_documentos_require_pending_insert' AND
        v_rec.actual ILIKE '%fiscal_require_pending_on_insert()%')
    ) THEN
      RAISE EXCEPTION 'BILL guard trigger definition differs: %', v_rec.tgname;
    END IF;
  END LOOP;

  -- BILL-001..003: existing table grants are a strict invariant. This is
  -- read/verify-only and never GRANTs or REVOKEs privileges on production.
  FOREACH v_table IN ARRAY ARRAY[
    'fiscal_documentos', 'fiscal_documento_itens', 'fiscal_documentos_eventos'
  ] LOOP
    FOREACH v_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF has_table_privilege(v_role, 'public.' || v_table, 'INSERT') OR
         has_table_privilege(v_role, 'public.' || v_table, 'UPDATE') OR
         has_table_privilege(v_role, 'public.' || v_table, 'DELETE') OR
         has_table_privilege(v_role, 'public.' || v_table, 'TRUNCATE') THEN
        RAISE EXCEPTION 'BILL-001/003 immutable fiscal ACL regression on % for %',
          v_table, v_role;
      END IF;
    END LOOP;
  END LOOP;

  IF has_function_privilege('anon', 'public.fiscal_reservar_numero_serie(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.fiscal_reservar_numero_serie(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.fiscal_finalizar_assinatura(uuid,text,text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.fiscal_finalizar_assinatura(uuid,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'BILL-003 fiscal RPC execute privilege regression';
  END IF;

  -- BILL-009: no new tax profile policy is created automatically. If the
  -- canonical migration did not create it, fail closed rather than expose it.
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='fiscal_tax_profiles'
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'BILL-009 fiscal tax profile RLS missing';
  END IF;
  IF to_regclass('public.ux_fiscal_tax_profiles_open_code') IS NULL
     OR to_regclass('public.idx_financeiro_itens_tax_profile') IS NULL
     OR to_regclass('public.idx_financeiro_tabelas_tax_profile') IS NULL THEN
    RAISE EXCEPTION 'BILL-009 fiscal tax profile indexes missing';
  END IF;
END
$guard$;
COMMIT;
