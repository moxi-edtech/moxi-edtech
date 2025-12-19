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

-- 3) Amarrando com sua tabela pagamentos
ALTER TABLE public.pagamentos
  ADD COLUMN IF NOT EXISTS mensalidade_id UUID REFERENCES public.mensalidades(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metodo_pagamento TEXT,       -- depois podemos virar enum
  ADD COLUMN IF NOT EXISTS origem TEXT,                 -- "secretaria", "portal_pais", etc.
  ADD COLUMN IF NOT EXISTS referencia_externa TEXT,     -- NSU TPA, ref. banco, etc.
  ADD COLUMN IF NOT EXISTS conciliado BOOLEAN NOT NULL DEFAULT false;

-- 4) Radar de inadimplência (view base)
DROP VIEW IF EXISTS public.vw_radar_inadimplencia;
CREATE OR REPLACE VIEW public.vw_radar_inadimplencia AS
SELECT
  m.id                          AS mensalidade_id,
  m.escola_id,
  m.aluno_id,
  m.turma_id,
  m.ano_letivo,
  m.mes_referencia,
  m.ano_referencia,
  m.valor_previsto,
  m.valor_pago_total,
  (m.valor_previsto - m.valor_pago_total) AS valor_em_atraso,
  m.data_vencimento,
  CURRENT_DATE - m.data_vencimento        AS dias_em_atraso,
  m.status,
  a.nome AS nome_aluno,
  t.nome          AS nome_turma
FROM public.mensalidades m
JOIN public.alunos  a ON a.id = m.aluno_id
LEFT JOIN public.turmas t ON t.id = m.turma_id
WHERE
  m.status IN ('pendente', 'pago_parcial')
  AND m.data_vencimento < CURRENT_DATE;


-- 5) RLS mínimo para manter multi-tenant
ALTER TABLE public.mensalidades ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Mensalidades - super admin' AND tablename = 'mensalidades'
  ) THEN
    CREATE POLICY "Mensalidades - super admin"
    ON public.mensalidades
    FOR ALL
    USING ( auth.role() = 'super_admin' );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Mensalidades - staff da escola - SELECT' AND tablename = 'mensalidades'
  ) THEN
    CREATE POLICY "Mensalidades - staff da escola - SELECT"
    ON public.mensalidades
    FOR SELECT
    USING ( public.is_staff_escola(escola_id) );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Mensalidades - staff da escola - UPDATE' AND tablename = 'mensalidades'
  ) THEN
    CREATE POLICY "Mensalidades - staff da escola - UPDATE"
    ON public.mensalidades
    FOR UPDATE
    USING ( public.is_staff_escola(escola_id) )
    WITH CHECK ( public.is_staff_escola(escola_id) );
  END IF;
END
$$;
