CREATE TABLE IF NOT EXISTS public.financeiro_fiscal_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE RESTRICT,
  empresa_id uuid NOT NULL REFERENCES public.fiscal_empresas(id) ON DELETE RESTRICT,
  origem_tipo text NOT NULL,
  origem_id text NOT NULL,
  fiscal_documento_id uuid NULL REFERENCES public.fiscal_documentos(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending',
  idempotency_key text NOT NULL,
  payload_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  fiscal_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financeiro_fiscal_links_status_chk CHECK (status IN ('pending', 'ok', 'failed')),
  CONSTRAINT ux_financeiro_fiscal_links_origem UNIQUE (origem_tipo, origem_id),
  CONSTRAINT ux_financeiro_fiscal_links_idempotency UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_financeiro_fiscal_links_escola_status
  ON public.financeiro_fiscal_links (escola_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_financeiro_fiscal_links_empresa_status
  ON public.financeiro_fiscal_links (empresa_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_financeiro_fiscal_links_fiscal_documento
  ON public.financeiro_fiscal_links (fiscal_documento_id);

ALTER TABLE public.pagamentos
  ADD COLUMN IF NOT EXISTS status_fiscal text NULL;

ALTER TABLE public.pagamentos
  ADD COLUMN IF NOT EXISTS fiscal_documento_id uuid NULL REFERENCES public.fiscal_documentos(id) ON DELETE SET NULL;

ALTER TABLE public.pagamentos
  ADD COLUMN IF NOT EXISTS fiscal_error text NULL;

ALTER TABLE public.pagamentos
  DROP CONSTRAINT IF EXISTS pagamentos_status_fiscal_chk;

ALTER TABLE public.pagamentos
  ADD CONSTRAINT pagamentos_status_fiscal_chk
  CHECK (status_fiscal IS NULL OR status_fiscal IN ('pending', 'ok', 'failed'));

CREATE INDEX IF NOT EXISTS idx_pagamentos_escola_status_fiscal
  ON public.pagamentos (escola_id, status_fiscal, created_at DESC);

ALTER TABLE public.mensalidades
  ADD COLUMN IF NOT EXISTS status_fiscal text NULL;

ALTER TABLE public.mensalidades
  ADD COLUMN IF NOT EXISTS fiscal_documento_id uuid NULL REFERENCES public.fiscal_documentos(id) ON DELETE SET NULL;

ALTER TABLE public.mensalidades
  ADD COLUMN IF NOT EXISTS fiscal_error text NULL;

ALTER TABLE public.mensalidades
  DROP CONSTRAINT IF EXISTS mensalidades_status_fiscal_chk;

ALTER TABLE public.mensalidades
  ADD CONSTRAINT mensalidades_status_fiscal_chk
  CHECK (status_fiscal IS NULL OR status_fiscal IN ('pending', 'ok', 'failed'));

CREATE INDEX IF NOT EXISTS idx_mensalidades_escola_status_fiscal
  ON public.mensalidades (escola_id, status_fiscal, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_fiscal_links TO authenticated;
