BEGIN;

-- Backfill default steps for onboarding requests created before the trigger existed.
INSERT INTO public.onboarding_steps (onboarding_id, step_code, title, status, owner_type, sla_days, deadline_at)
SELECT
  r.id,
  v.step_code,
  v.title,
  'pendente',
  v.owner_type,
  v.sla_days,
  r.created_at + make_interval(days => v.sla_days)
FROM public.onboarding_requests r
CROSS JOIN (
  VALUES
    ('nif', 'Verificação do NIF e Alvará', 'klasse', 2),
    ('planilha_alunos', 'Envio da Planilha de Alunos', 'escola', 7),
    ('treinamento', 'Formação da Equipa da Escola', 'parceiro', 5),
    ('ativacao', 'Ativação e Publicação do Portal', 'klasse', 1)
) AS v(step_code, title, owner_type, sla_days)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.onboarding_steps s
  WHERE s.onboarding_id = r.id
    AND s.step_code = v.step_code
);

-- Public tracking must go through SECURITY DEFINER RPCs, not permissive table-wide SELECT.
DROP POLICY IF EXISTS "onboarding_select_by_token" ON public.onboarding_requests;
DROP POLICY IF EXISTS "onboarding_steps_select_policy" ON public.onboarding_steps;
DROP POLICY IF EXISTS "onboarding_uploads_select_policy" ON public.onboarding_uploads;
DROP POLICY IF EXISTS "onboarding_uploads_insert_policy" ON public.onboarding_uploads;

-- Storage metadata/history is surfaced by RPCs; object reads stay private.
DROP POLICY IF EXISTS "Permitir leitura de documentos de onboarding para todos" ON storage.objects;

CREATE OR REPLACE FUNCTION public.get_onboarding_tracking_payload(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_request public.onboarding_requests%ROWTYPE;
  v_steps jsonb;
  v_uploads jsonb;
BEGIN
  SELECT *
    INTO v_request
  FROM public.onboarding_requests
  WHERE tracking_token = upper(trim(coalesce(p_token, '')))
  LIMIT 1;

  IF v_request.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pedido não encontrado');
  END IF;

  SELECT coalesce(
    jsonb_agg(to_jsonb(s) ORDER BY s.created_at ASC),
    '[]'::jsonb
  )
    INTO v_steps
  FROM public.onboarding_steps s
  WHERE s.onboarding_id = v_request.id;

  SELECT coalesce(
    jsonb_agg(to_jsonb(u) ORDER BY u.created_at DESC),
    '[]'::jsonb
  )
    INTO v_uploads
  FROM public.onboarding_uploads u
  WHERE u.onboarding_id = v_request.id;

  RETURN jsonb_build_object(
    'ok', true,
    'request', to_jsonb(v_request),
    'steps', v_steps,
    'uploads', v_uploads
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_onboarding_upload_by_token(
  p_token text,
  p_step_code text,
  p_file_path text,
  p_created_by text
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

  INSERT INTO public.onboarding_uploads (
    onboarding_id,
    step_code,
    file_path,
    status,
    created_by
  )
  VALUES (
    v_request.id,
    trim(coalesce(p_step_code, '')),
    p_file_path,
    'pendente',
    p_created_by
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

GRANT EXECUTE ON FUNCTION public.get_onboarding_tracking_payload(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_onboarding_upload_by_token(text, text, text, text) TO anon, authenticated;

COMMIT;
