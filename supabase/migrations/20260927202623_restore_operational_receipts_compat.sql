DO $rename$
BEGIN
  IF to_regprocedure('public._emitir_recibo_operacional_internal(uuid)') IS NULL
     AND to_regprocedure('public.emitir_recibo(uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.emitir_recibo(uuid)
      RENAME TO _emitir_recibo_operacional_internal;
  END IF;

  IF to_regprocedure('public._emitir_recibo_servicos_operacional_internal(uuid)') IS NULL
     AND to_regprocedure('public.emitir_recibo_servicos(uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.emitir_recibo_servicos(uuid)
      RENAME TO _emitir_recibo_servicos_operacional_internal;
  END IF;
END
$rename$;

REVOKE ALL ON FUNCTION public._emitir_recibo_operacional_internal(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._emitir_recibo_servicos_operacional_internal(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.emitir_recibo(p_mensalidade_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_escola_id uuid;
BEGIN
  SELECT m.escola_id
  INTO v_escola_id
  FROM public.mensalidades m
  WHERE m.id = p_mensalidade_id;

  IF v_escola_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Mensalidade não encontrada');
  END IF;

  IF NOT public.user_has_role_in_school(
    v_escola_id,
    ARRAY[
      'secretaria',
      'financeiro',
      'secretaria_financeiro',
      'admin_financeiro',
      'admin',
      'admin_escola',
      'staff_admin'
    ]::text[]
  ) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'FORBIDDEN');
  END IF;

  RETURN public._emitir_recibo_operacional_internal(p_mensalidade_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.emitir_recibo_servicos(p_pagamento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_escola_id uuid;
BEGIN
  SELECT p.escola_id
  INTO v_escola_id
  FROM public.pagamentos p
  WHERE p.id = p_pagamento_id;

  IF v_escola_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Pagamento não encontrado');
  END IF;

  IF NOT public.user_has_role_in_school(
    v_escola_id,
    ARRAY[
      'secretaria',
      'financeiro',
      'secretaria_financeiro',
      'admin_financeiro',
      'admin',
      'admin_escola',
      'staff_admin'
    ]::text[]
  ) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'FORBIDDEN');
  END IF;

  RETURN public._emitir_recibo_servicos_operacional_internal(p_pagamento_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.emitir_recibo(uuid)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.emitir_recibo_servicos(uuid)
  FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.emitir_recibo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.emitir_recibo_servicos(uuid) TO authenticated;

COMMENT ON FUNCTION public.emitir_recibo(uuid) IS
  'Compatibility API for operational (non-AGT, non-fiscal) tuition payment receipts. Authorized school staff only.';
COMMENT ON FUNCTION public.emitir_recibo_servicos(uuid) IS
  'Compatibility API for operational (non-AGT, non-fiscal) service payment receipts. Authorized school staff only.';
