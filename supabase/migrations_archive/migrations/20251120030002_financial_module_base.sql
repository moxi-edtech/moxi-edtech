-- Financial Module Base: mensalidades and pagamentos tables

-- 1) Enum de status de mensalidade
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'mensalidade_status'
  ) THEN
    CREATE TYPE mensalidade_status AS ENUM (
      'pendente',       -- gerada, ainda não paga
      'pago_parcial',   -- pagamento menor que o valor previsto
      'pago',           -- quitada
      'isento',         -- isenção aprovada
      'cancelado'       -- matrícula cancelada / não cobrar
    );
  END IF;
END
$$;

-- 2) Tabela de mensalidades
CREATE TABLE IF NOT EXISTS public.mensalidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  escola_id UUID NOT NULL REFERENCES public.escolas (id) ON DELETE CASCADE,
  aluno_id  UUID NOT NULL REFERENCES public.alunos  (id) ON DELETE CASCADE,
  turma_id  UUID REFERENCES public.turmas (id) ON DELETE SET NULL,

  ano_letivo      TEXT NOT NULL,        -- ex: "2025"
  mes_referencia  SMALLINT NOT NULL,    -- 1..12
  ano_referencia  INTEGER NOT NULL,     -- ex: 2025

  valor_previsto      NUMERIC(14,2) NOT NULL,  -- quanto deveria pagar
  valor_pago_total    NUMERIC(14,2) NOT NULL DEFAULT 0,
  status              mensalidade_status NOT NULL DEFAULT 'pendente',

  data_vencimento     DATE NOT NULL,
  data_pagamento_efetiva DATE,

  observacoes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensalidades_escola
  ON public.mensalidades(escola_id);

CREATE INDEX IF NOT EXISTS idx_mensalidades_aluno
  ON public.mensalidades(aluno_id);

CREATE INDEX IF NOT EXISTS idx_mensalidades_status_vencimento
  ON public.mensalidades(status, data_vencimento);

-- 3) Tabela de pagamentos (novo)
CREATE TABLE IF NOT EXISTS public.pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id UUID NOT NULL REFERENCES public.escolas (id) ON DELETE CASCADE,
  mensalidade_id UUID REFERENCES public.mensalidades (id) ON DELETE SET NULL, -- assuming 1 payment -> 1 mensalidade for MVP

  valor_pago      NUMERIC(14,2) NOT NULL,
  metodo_pagamento TEXT, -- e.g., 'cartao', 'boleto', 'pix'
  data_pagamento  DATE NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pagamentos_escola
  ON public.pagamentos(escola_id);

CREATE INDEX IF NOT EXISTS idx_pagamentos_mensalidade
  ON public.pagamentos(mensalidade_id);
