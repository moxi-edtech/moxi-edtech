-- CURTUME 2025/2026: extend the already school-scoped, signed exception
-- workflow to exact admin_financeiro membership. No bypass of RAA or RLS.
-- This is not a data rewrite: old notes/results and snapshots are unchanged.
DO $migration$
DECLARE
  v_function regprocedure;
  v_sql text;
  v_old text := $old$'admin','admin_escola','diretor'$old$;
  v_new text := $new$'admin','admin_escola','diretor','admin_financeiro'$new$;
  v_old_count integer;
  v_target text;
BEGIN
  FOREACH v_target IN ARRAY ARRAY[
    'public.curtume_fechar_pautas_2025_lote(uuid,uuid,uuid,integer)',
    'public.curtume_2025_conferir_notas_documentais(uuid,uuid,text,text)',
    'public.curtume_2025_regularizar_origem_documental(uuid,uuid,uuid,text,text)',
    'public.curtume_2025_transcrever_pauta_fisica(uuid,uuid,uuid,text,text,jsonb,boolean)',
    'public.curtume_2025_status_conferencia(uuid,uuid)'
  ] LOOP
    v_function := to_regprocedure(v_target);
    IF v_function IS NULL THEN
      RAISE EXCEPTION 'CURTUME_ROLE_PATCH_MISSING_FUNCTION: %', v_target;
    END IF;
    v_sql := pg_catalog.pg_get_functiondef(v_function);
    v_old_count := (length(v_sql) - length(replace(v_sql, v_old, ''))) / length(v_old);
    IF v_old_count IS DISTINCT FROM 1 THEN
      RAISE EXCEPTION 'CURTUME_ROLE_PATCH_GUARD_CHANGED: % (matches=%)', v_target, v_old_count;
    END IF;
    -- Keep signature, ownership, tenant checks, reasons, rate limits, existing
    -- SECURITY DEFINER safeguards and explicit grants exactly as reviewed.
    EXECUTE replace(v_sql, v_old, v_new);
  END LOOP;
END;
$migration$;
