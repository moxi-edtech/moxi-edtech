BEGIN;

-- Remove the last runtime consumer of vw_escola_setup_status.
-- That view is backed by internal.mv_escola_setup_status, whose snapshot can be
-- missing/stale. Keep the partner session/tenant authorization and JSON contract
-- unchanged; change only the "has_turmas_no_ano" source to a bounded EXISTS.
--
-- Amend the installed function rather than restore an older copy of its body:
-- the production function can contain later security improvements.
DO $migration$
DECLARE
  v_oid oid := to_regprocedure('public.get_influencer_member_portal_by_session(uuid,text)');
  v_definition text;
  v_old_field constant text := 'vs.has_turmas_no_ano,';
  v_old_join constant text := $old$LEFT JOIN public.vw_escola_setup_status vs
              ON vs.escola_id = obr.escola_id$old$;
  v_new_field constant text := $new$CASE
                WHEN obr.escola_id IS NULL THEN NULL
                ELSE EXISTS (
                  SELECT 1
                  FROM public.anos_letivos al
                  JOIN public.turmas t
                    ON t.escola_id = al.escola_id
                   AND t.ano_letivo = al.ano
                  WHERE al.escola_id = obr.escola_id
                    AND al.ativo IS TRUE
                )
              END AS has_turmas_no_ano,$new$;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'Partner portal function is missing; cannot safely detach setup view';
  END IF;

  v_definition := pg_get_functiondef(v_oid);

  -- Idempotent on databases where the patch was already installed.
  IF strpos(v_definition, 'vw_escola_setup_status') = 0
     AND strpos(v_definition, 'END AS has_turmas_no_ano,') > 0 THEN
    RETURN;
  END IF;

  -- Fail closed if the current function has drifted rather than silently
  -- overwriting authentication checks or a different implementation.
  IF strpos(v_definition, v_old_field) = 0
     OR strpos(v_definition, v_old_join) = 0 THEN
    RAISE EXCEPTION 'Partner portal function changed; review before detaching setup view';
  END IF;

  v_definition := replace(v_definition, v_old_field, v_new_field);
  v_definition := replace(v_definition, v_old_join, '');

  -- CREATE OR REPLACE preserves the existing owner, execute grants and
  -- SECURITY DEFINER/session-token checks in the function.
  EXECUTE v_definition;

  IF strpos(
    pg_get_functiondef('public.get_influencer_member_portal_by_session(uuid,text)'::regprocedure),
    'vw_escola_setup_status'
  ) > 0 THEN
    RAISE EXCEPTION 'Stale setup view dependency remains in partner portal';
  END IF;
END;
$migration$;

COMMIT;
