-- Migration: log_onboarding_call_followup RPC
-- Created at: 2026-06-23

CREATE OR REPLACE FUNCTION public.log_onboarding_call_followup(
  p_codigo text,
  p_member_id uuid,
  p_pin text,
  p_onboarding_token text,
  p_step_code text,
  p_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog, pg_temp
AS $$
DECLARE
  v_codigo text;
  v_nome text;
  v_member_nome text;
  v_onboarding_id uuid;
  v_escola_id uuid;
  v_escola_nome text;
  v_step_title text;
BEGIN
  v_codigo := upper(trim(coalesce(p_codigo, '')));

  -- 1. Validar membro e obter o nome
  SELECT a.codigo, a.nome, m.nome
    INTO v_codigo, v_nome, v_member_nome
  FROM public.afiliados a
  JOIN public.afiliado_membros m ON m.afiliado_id = a.id
  WHERE a.codigo = v_codigo
    AND a.ativo = true
    AND m.id = p_member_id
    AND m.ativo = true
    AND m.pin_hash = extensions.crypt(coalesce(p_pin, ''), m.pin_hash)
  LIMIT 1;

  IF v_codigo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_credentials');
  END IF;

  -- 2. Validar se o onboarding pertence a este afiliado e buscar dados
  SELECT r.id, r.escola_id, r.escola_nome
    INTO v_onboarding_id, v_escola_id, v_escola_nome
  FROM public.onboarding_requests r
  WHERE r.tracking_token = p_onboarding_token
    AND upper(r.financeiro->>'influencer_codigo') = v_codigo
  LIMIT 1;

  IF v_onboarding_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'onboarding_not_found');
  END IF;

  -- 3. Obter título do step se informado
  IF p_step_code IS NOT NULL AND p_step_code <> '' THEN
    SELECT s.title INTO v_step_title
    FROM public.onboarding_steps s
    WHERE s.onboarding_id = v_onboarding_id
      AND s.step_code = p_step_code
    LIMIT 1;
  END IF;

  -- 4. Registrar em audit_logs
  INSERT INTO public.audit_logs (
    escola_id,
    portal,
    acao,
    tabela,
    registro_id,
    entity,
    entity_id,
    details
  ) VALUES (
    v_escola_id,
    'influencer_portal',
    'PARTNER_CALL_FOLLOWUP',
    'onboarding_requests',
    v_onboarding_id::text,
    'onboarding_requests',
    v_onboarding_id::text,
    jsonb_build_object(
      'member_id', p_member_id,
      'member_name', v_member_nome,
      'influencer_codigo', v_codigo,
      'step_code', p_step_code,
      'step_title', coalesce(v_step_title, ''),
      'notes', coalesce(p_notes, ''),
      'realizado_em', now()
    )
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_onboarding_call_followup(text, uuid, text, text, text, text) TO anon, authenticated;
