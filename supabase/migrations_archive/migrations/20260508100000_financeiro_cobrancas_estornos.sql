BEGIN;

DO $$ BEGIN
  CREATE TYPE public.cobranca_status AS ENUM (
    'enviada',
    'entregue',
    'respondida',
    'paga',
    'falha'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.financeiro_cobrancas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  mensalidade_id uuid REFERENCES public.mensalidades(id) ON DELETE SET NULL,
  canal text NOT NULL CHECK (canal IN ('whatsapp', 'sms', 'email', 'manual')),
  status public.cobranca_status NOT NULL DEFAULT 'enviada',
  mensagem text,
  resposta text,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cobrancas_escola_enviado
  ON public.financeiro_cobrancas (escola_id, enviado_em DESC);

CREATE INDEX IF NOT EXISTS idx_cobrancas_aluno
  ON public.financeiro_cobrancas (aluno_id, enviado_em DESC);

CREATE INDEX IF NOT EXISTS idx_cobrancas_status
  ON public.financeiro_cobrancas (status);

ALTER TABLE public.financeiro_cobrancas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'financeiro_cobrancas'
      AND policyname = 'cobrancas_tenant_isolation'
  ) THEN
    CREATE POLICY cobrancas_tenant_isolation
      ON public.financeiro_cobrancas
      USING (escola_id = public.current_tenant_escola_id())
      WITH CHECK (escola_id = public.current_tenant_escola_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.financeiro_estornos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  mensalidade_id uuid NOT NULL REFERENCES public.mensalidades(id) ON DELETE CASCADE,
  valor numeric(14,2) NOT NULL DEFAULT 0,
  motivo text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estornos_escola_created
  ON public.financeiro_estornos (escola_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_estornos_mensalidade
  ON public.financeiro_estornos (mensalidade_id);

ALTER TABLE public.financeiro_estornos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'financeiro_estornos'
      AND policyname = 'estornos_tenant_isolation'
  ) THEN
    CREATE POLICY estornos_tenant_isolation
      ON public.financeiro_estornos
      USING (escola_id = public.current_tenant_escola_id())
      WITH CHECK (escola_id = public.current_tenant_escola_id());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.estornar_mensalidade(
  p_mensalidade_id uuid,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_m public.mensalidades%ROWTYPE;
  v_valor numeric(14,2);
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_m
  FROM public.mensalidades
  WHERE id = p_mensalidade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Mensalidade não encontrada');
  END IF;

  IF v_m.status <> 'pago' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Apenas mensalidades pagas podem ser estornadas');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = v_user_id
      AND (p.escola_id = v_m.escola_id OR p.current_escola_id = v_m.escola_id)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'FORBIDDEN');
  END IF;

  v_valor := COALESCE(v_m.valor_pago_total, v_m.valor_previsto, 0);

  INSERT INTO public.financeiro_estornos (
    escola_id,
    mensalidade_id,
    valor,
    motivo,
    created_by
  ) VALUES (
    v_m.escola_id,
    v_m.id,
    v_valor,
    NULLIF(btrim(p_motivo), ''),
    v_user_id
  );

  UPDATE public.pagamentos
  SET status = 'cancelado'
  WHERE mensalidade_id = v_m.id
    AND status = 'pago';

  UPDATE public.mensalidades
  SET
    status = 'pendente',
    valor_pago_total = 0,
    data_pagamento_efetiva = NULL,
    metodo_pagamento = NULL,
    observacao = CASE
      WHEN COALESCE(btrim(p_motivo), '') = '' THEN
        COALESCE(observacao, '') || ' [ESTORNO]'
      ELSE
        COALESCE(observacao, '') || ' [ESTORNO] ' || btrim(p_motivo)
    END,
    updated_at = now(),
    updated_by = v_user_id
  WHERE id = v_m.id;

  RETURN jsonb_build_object(
    'ok', true,
    'mensalidade_id', v_m.id,
    'valor_estornado', v_valor
  );
END;
$$;

REVOKE ALL ON FUNCTION public.estornar_mensalidade(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.estornar_mensalidade(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.estornar_mensalidade(uuid, text) TO service_role;

COMMIT;
