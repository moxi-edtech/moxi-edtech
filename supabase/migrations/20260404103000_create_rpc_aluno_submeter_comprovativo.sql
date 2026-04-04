BEGIN;

DROP FUNCTION IF EXISTS public.aluno_submeter_comprovativo_pagamento(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.aluno_submeter_comprovativo_pagamento(uuid, text, numeric, jsonb);

CREATE OR REPLACE FUNCTION public.aluno_submeter_comprovativo_pagamento(
  p_mensalidade_id uuid,
  p_evidence_url text,
  p_valor_informado numeric DEFAULT NULL,
  p_meta jsonb DEFAULT '{}'::jsonb,
  p_mensagem text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor_id uuid := public.safe_auth_uid();
  v_escola_id uuid := public.current_tenant_escola_id();
  v_actor_email text;
  v_mensalidade public.mensalidades%ROWTYPE;
  v_pagamento public.pagamentos%ROWTYPE;
  v_valor_pendente numeric(12,2);
  v_valor_submetido numeric(12,2);
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: not_authenticated';
  END IF;

  IF v_escola_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: tenant_not_resolved';
  END IF;

  IF p_mensalidade_id IS NULL THEN
    RAISE EXCEPTION 'DATA: mensalidade_id obrigatório';
  END IF;

  IF COALESCE(trim(p_evidence_url), '') = '' THEN
    RAISE EXCEPTION 'DATA: evidence_url obrigatório';
  END IF;

  SELECT *
    INTO v_mensalidade
  FROM public.mensalidades
  WHERE id = p_mensalidade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: mensalidade não encontrada';
  END IF;

  IF v_mensalidade.escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: cross_tenant_forbidden';
  END IF;

  SELECT u.email
    INTO v_actor_email
  FROM auth.users u
  WHERE u.id = v_actor_id;

  IF NOT EXISTS (
    SELECT 1
    FROM public.alunos a
    WHERE a.id = v_mensalidade.aluno_id
      AND a.escola_id = v_escola_id
      AND (
        a.profile_id = v_actor_id
        OR EXISTS (
          SELECT 1
          FROM public.aluno_encarregados ae
          JOIN public.encarregados e ON e.id = ae.encarregado_id
          WHERE ae.aluno_id = a.id
            AND ae.escola_id = v_escola_id
            AND e.escola_id = v_escola_id
            AND COALESCE(lower(e.email), '') = COALESCE(lower(v_actor_email), '')
        )
      )
  ) THEN
    RAISE EXCEPTION 'AUTH: aluno_not_allowed';
  END IF;

  IF COALESCE(v_mensalidade.status, 'pendente') = 'pago' THEN
    RAISE EXCEPTION 'DATA: mensalidade já paga';
  END IF;

  v_valor_pendente := GREATEST(
    COALESCE(v_mensalidade.valor_previsto, v_mensalidade.valor, 0) - COALESCE(v_mensalidade.valor_pago_total, 0),
    0
  );

  IF v_valor_pendente <= 0 THEN
    RAISE EXCEPTION 'DATA: mensalidade sem saldo pendente';
  END IF;

  v_valor_submetido := COALESCE(p_valor_informado, v_valor_pendente);

  IF v_valor_submetido <= 0 THEN
    RAISE EXCEPTION 'DATA: valor_informado inválido';
  END IF;

  IF v_valor_submetido > v_valor_pendente + 0.01 THEN
    RAISE EXCEPTION 'DATA: valor_informado excede saldo pendente';
  END IF;

  SELECT *
    INTO v_pagamento
  FROM public.pagamentos
  WHERE escola_id = v_escola_id
    AND mensalidade_id = v_mensalidade.id
    AND status = 'pending'
    AND created_by = v_actor_id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.pagamentos
    SET evidence_url = p_evidence_url,
        valor_pago = v_valor_submetido,
        updated_at = now(),
        meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
          'comprovativo',
          jsonb_build_object(
            'resubmitted_at', now(),
            'resubmitted_by', v_actor_id,
            'mensagem_aluno', NULLIF(trim(p_mensagem), '')
          )
        ) || COALESCE(p_meta, '{}'::jsonb)
    WHERE id = v_pagamento.id
    RETURNING * INTO v_pagamento;

    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'pagamento_id', v_pagamento.id,
      'valor_enviado', v_pagamento.valor_pago,
      'status', v_pagamento.status
    );
  END IF;

  INSERT INTO public.pagamentos (
    escola_id,
    aluno_id,
    mensalidade_id,
    valor_pago,
    data_pagamento,
    metodo,
    metodo_pagamento,
    status,
    evidence_url,
    created_by,
    meta
  ) VALUES (
    v_escola_id,
    v_mensalidade.aluno_id,
    v_mensalidade.id,
    v_valor_submetido,
    CURRENT_DATE,
    'transfer',
    'transferencia',
    'pending',
    p_evidence_url,
    v_actor_id,
    COALESCE(p_meta, '{}'::jsonb) || jsonb_build_object(
      'origem', 'portal_aluno_upload_comprovativo',
      'submitted_at', now(),
      'submitted_by', v_actor_id,
      'comprovativo', jsonb_build_object(
        'mensagem_aluno', NULLIF(trim(p_mensagem), '')
      )
    )
  )
  RETURNING * INTO v_pagamento;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'pagamento_id', v_pagamento.id,
    'valor_enviado', v_pagamento.valor_pago,
    'status', v_pagamento.status
  );
END;
$$;

ALTER FUNCTION public.aluno_submeter_comprovativo_pagamento(uuid, text, numeric, jsonb, text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.aluno_submeter_comprovativo_pagamento(uuid, text, numeric, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aluno_submeter_comprovativo_pagamento(uuid, text, numeric, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aluno_submeter_comprovativo_pagamento(uuid, text, numeric, jsonb, text) TO service_role;

COMMIT;
