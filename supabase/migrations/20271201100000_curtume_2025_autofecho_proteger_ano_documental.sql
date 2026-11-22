-- Curtume 2025/2026: automatic legal close must not ratify a contradictory
-- original document year without a school-approved source correction.
-- Reuses the *existing* school/role-checked, per-pupil transactional RAA
-- finalizer; no new grade writer, no change to closed historical snapshots.
-- The expected digest is the exact live function body at 2026-11-22.
BEGIN;

DO $migration$
DECLARE
  v_oid oid;
  v_original text;
  v_definition text;
  v_old text;
  v_new text;
BEGIN
  SELECT p.oid, p.prosrc INTO v_oid,v_original
  FROM pg_catalog.pg_proc p
  WHERE p.pronamespace='public'::regnamespace
    AND p.proname='curtume_fechar_pautas_2025_lote'
    AND pg_catalog.pg_get_function_identity_arguments(p.oid)=
        'p_escola_id uuid, p_lote_id uuid, p_depois uuid, p_limite integer';

  IF v_oid IS NULL OR pg_catalog.md5(v_original) IS DISTINCT FROM
         '480edb93d338672e9a6df2dee0a5d72a' THEN
    RAISE EXCEPTION 'CURTUME_2025_BATCH_SOURCE_DRIFT' USING ERRCODE='23514';
  END IF;
  v_definition := pg_catalog.pg_get_functiondef(v_oid);
  v_old := $anchor$
      -- Names like '2023-24' in a legacy XLSX filename are not a reason to
      -- discard a 2025/2026 school import with explicit 2025 metadata.
$anchor$;
  v_new := $replacement$
      -- Documented results may be considered for automatic closure only
      -- when the year on the original is not contradictory. Source metadata
      -- on its own never proves that an older filename means 2025/2026.
      IF EXISTS (
        SELECT 1
        FROM public.historico_disciplinas hd
        WHERE hd.historico_ano_id=v_row.historico_id
          AND coalesce(hd.notas_detalhe->>'arquivo','') ~*
              '(2023[-_/ ]?24|2023[-_/ ]?2024)'
          AND NOT (
            hd.notas_detalhe->>'correcao_tipo'='ano_documental'
            AND hd.notas_detalhe->>'ano_referencia_confirmado'='2025/2026'
          )
      ) THEN
        RAISE EXCEPTION 'PAUTA_ANO_DIVERGENTE_EXIGE_CONFERENCIA'
          USING ERRCODE='23514';
      END IF;

$replacement$;
  IF pg_catalog.strpos(v_definition,v_old)=0
      OR pg_catalog.strpos(pg_catalog.substr(v_definition,
          pg_catalog.strpos(v_definition,v_old)+length(v_old)),v_old)>0 THEN
    RAISE EXCEPTION 'CURTUME_2025_BATCH_PATCH_ANCHOR_DRIFT'
      USING ERRCODE='23514';
  END IF;
  -- Keep the existing SECURITY DEFINER auth checks, audit, advisory lock,
  -- RAA verification, and per-pupil subtransactions byte-for-byte unchanged.
  EXECUTE pg_catalog.replace(v_definition,v_old,v_new);
END;
$migration$;

COMMIT;
