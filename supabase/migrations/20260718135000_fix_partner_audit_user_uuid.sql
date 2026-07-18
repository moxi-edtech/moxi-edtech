BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.replace_named_function_fragment(
  p_name name,
  p_old text,
  p_new text
)
RETURNS void
LANGUAGE plpgsql
AS $helper$
DECLARE
  v_oid oid;
  v_count integer;
  v_definition text;
BEGIN
  SELECT count(*), min(p.oid)
  INTO v_count, v_oid
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = p_name;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected one public.% function, found %', p_name, v_count;
  END IF;

  SELECT pg_get_functiondef(v_oid) INTO v_definition;
  IF strpos(v_definition, p_old) = 0 THEN
    RAISE EXCEPTION 'Expected fragment not found in public.%', p_name;
  END IF;
  EXECUTE replace(v_definition, p_old, p_new);
END;
$helper$;

SELECT pg_temp.replace_named_function_fragment(
  'update_influencer_crm_lead_commercial_terms',
  $old$    coalesce(v_member_id::text, 'system'),$old$,
  $new$    v_member_id,$new$
);

SELECT pg_temp.replace_named_function_fragment(
  'convert_influencer_crm_lead_to_onboarding',
  $old$    coalesce(v_member_id::text, 'system'),$old$,
  $new$    v_member_id,$new$
);

SELECT pg_temp.replace_named_function_fragment(
  'create_influencer_partner_commission_payout',
  $old$    coalesce(v_member_id::text, 'system'),$old$,
  $new$    v_member_id,$new$
);

SELECT pg_temp.replace_named_function_fragment(
  'generate_partner_commission_for_saas_payment',
  $old$    coalesce(p_actor_id::text, 'system'),$old$,
  $new$    p_actor_id,$new$
);

SELECT pg_temp.replace_named_function_fragment(
  'update_influencer_support_ticket',
  $old$    v_session.member_id::text,$old$,
  $new$    v_session.member_id,$new$
);

COMMIT;
