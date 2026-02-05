CREATE TABLE IF NOT EXISTS public.servicos_escola (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  codigo text NOT NULL,
  nome text NOT NULL,
  descricao text,
  valor_base numeric(12,0) NOT NULL DEFAULT 0,
  pode_bloquear_por_debito boolean NOT NULL DEFAULT false,
  exige_pagamento_antes_de_liberar boolean NOT NULL DEFAULT false,
  aceita_pagamento_pendente boolean NOT NULL DEFAULT false,
  exige_aprovacao boolean NOT NULL DEFAULT false,
  documentos_necessarios jsonb NOT NULL DEFAULT '[]'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT servicos_escola_codigo_uniq UNIQUE (escola_id, codigo)
);

CREATE INDEX IF NOT EXISTS ix_servicos_escola_escola ON public.servicos_escola (escola_id);

CREATE TABLE IF NOT EXISTS public.servico_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  matricula_id uuid,
  servico_escola_id uuid NOT NULL REFERENCES public.servicos_escola(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status in ('blocked','granted','pending_payment','canceled')),
  reason_code text,
  reason_detail text,
  servico_codigo text NOT NULL,
  servico_nome text NOT NULL,
  valor_cobrado numeric(12,0) NOT NULL DEFAULT 0,
  contexto jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_servico_pedidos_escola ON public.servico_pedidos (escola_id, created_at desc);
CREATE INDEX IF NOT EXISTS ix_servico_pedidos_aluno ON public.servico_pedidos (escola_id, aluno_id, created_at desc);
CREATE INDEX IF NOT EXISTS ix_servico_pedidos_status ON public.servico_pedidos (escola_id, status);

CREATE TABLE IF NOT EXISTS public.pagamento_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  servico_pedido_id uuid REFERENCES public.servico_pedidos(id) ON DELETE SET NULL,
  amount numeric(12,0) NOT NULL,
  currency text NOT NULL DEFAULT 'AOA',
  method text NOT NULL CHECK (method in ('cash','tpa','transfer','mcx','kiwk')),
  status text NOT NULL CHECK (status in ('draft','pending','settled','canceled','failed')),
  reference text,
  terminal_id text,
  evidence_url text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);

CREATE INDEX IF NOT EXISTS ix_pagamento_intents_escola ON public.pagamento_intents (escola_id, created_at desc);
CREATE INDEX IF NOT EXISTS ix_pagamento_intents_status ON public.pagamento_intents (escola_id, status);
CREATE INDEX IF NOT EXISTS ix_pagamento_intents_ref ON public.pagamento_intents (escola_id, reference);
