BEGIN;

CREATE OR REPLACE FUNCTION public.create_onboarding_upload_by_token(
  p_token text,
  p_step_code text,
  p_file_path text,
  p_created_by text,
  p_criado_por_membro_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_request public.onboarding_requests%ROWTYPE;
  v_step public.onboarding_steps%ROWTYPE;
  v_upload public.onboarding_uploads%ROWTYPE;
  v_member public.afiliado_membros%ROWTYPE;
  v_influencer_codigo text;
BEGIN
  SELECT *
    INTO v_request
  FROM public.onboarding_requests
  WHERE tracking_token = upper(trim(coalesce(p_token, '')))
  LIMIT 1;

  IF v_request.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Onboarding não encontrado.');
  END IF;

  SELECT *
    INTO v_step
  FROM public.onboarding_steps
  WHERE onboarding_id = v_request.id
    AND step_code = trim(coalesce(p_step_code, ''))
  LIMIT 1;

  IF v_step.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Etapa de onboarding não encontrada.');
  END IF;

  IF p_created_by NOT IN ('escola', 'parceiro') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Origem do upload inválida.');
  END IF;

  IF p_created_by = 'escola' AND v_step.owner_type <> 'escola' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'A escola só pode enviar ficheiros para etapas da sua responsabilidade.');
  END IF;

  IF p_created_by = 'parceiro' AND v_step.owner_type <> 'parceiro' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'O parceiro só pode enviar ficheiros para etapas da sua responsabilidade.');
  END IF;

  IF p_created_by = 'parceiro' THEN
    IF p_criado_por_membro_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Membro do parceiro é obrigatório para este upload.');
    END IF;

    v_influencer_codigo := upper(coalesce(v_request.financeiro->>'influencer_codigo', ''));
    IF v_influencer_codigo = '' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Onboarding sem parceiro associado.');
    END IF;

    SELECT m.*
      INTO v_member
    FROM public.afiliado_membros m
    JOIN public.afiliados a
      ON a.id = m.afiliado_id
    WHERE m.id = p_criado_por_membro_id
      AND m.ativo = true
      AND a.ativo = true
      AND a.codigo = v_influencer_codigo
    LIMIT 1;

    IF v_member.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Membro do parceiro inválido para este onboarding.');
    END IF;
  ELSE
    p_criado_por_membro_id := NULL;
  END IF;

  INSERT INTO public.onboarding_uploads (
    onboarding_id,
    step_code,
    file_path,
    status,
    created_by,
    criado_por_membro_id
  )
  VALUES (
    v_request.id,
    trim(coalesce(p_step_code, '')),
    p_file_path,
    'pendente',
    p_created_by,
    p_criado_por_membro_id
  )
  RETURNING *
    INTO v_upload;

  IF v_step.status = 'pendente' THEN
    UPDATE public.onboarding_steps
    SET status = 'em_progresso',
        updated_at = now()
    WHERE id = v_step.id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'upload', to_jsonb(v_upload));
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_onboarding_upload_by_token(text, text, text, text, uuid) TO anon, authenticated;

COMMIT;
