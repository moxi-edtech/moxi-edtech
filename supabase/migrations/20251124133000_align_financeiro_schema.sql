-- Alinhamento do esquema financeiro: mensalidades, pagamentos e visões auxiliares
-- Objetivo: evoluir a tabela mensalidades existente (id, created_at, aluno_id, valor, data_vencimento, status)
-- para o modelo mais rico usado pelo app, SEM quebrar o que já existe.

------------------------------------------------------------
-- 1) Enum de status de mensalidade (idempotente)
------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mensalidade_status') THEN
    CREATE TYPE mensalidade_status AS ENUM (
      'pendente',
      'pago_parcial',
      'pago',
      'isento',
      'cancelado'
    );
  END IF;
END$$;

------------------------------------------------------------
-- 2) Evolução da tabela mensalidades (idempotente / safe)
------------------------------------------------------------
DO $$
BEGIN
  -- Se a tabela ainda não existir (caso raro), criamos já no modelo completo
  IF to_regclass('public.mensalidades') IS NULL THEN
    CREATE TABLE public.mensalidades (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      escola_id UUID NOT NULL REFERENCES public.escolas (id) ON DELETE CASCADE,
      aluno_id  UUID NOT NULL REFERENCES public.alunos  (id) ON DELETE CASCADE,
      turma_id  UUID REFERENCES public.turmas (id) ON DELETE SET NULL,

      ano_letivo      TEXT NOT NULL,
      mes_referencia  SMALLINT NOT NULL,
      ano_referencia  INTEGER NOT NULL,

      valor_previsto      NUMERIC(14,2) NOT NULL,
      valor_pago_total    NUMERIC(14,2) NOT NULL DEFAULT 0,
      status              mensalidade_status NOT NULL DEFAULT 'pendente',

      data_vencimento        DATE NOT NULL,
      data_pagamento_efetiva DATE,

      observacoes TEXT,

      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  ELSE
    -- Se a tabela já existe (como no cenário atual), evoluímos ela sem destruir nada.

    -- Escola / Turma
    BEGIN
      ALTER TABLE public.mensalidades
        ADD COLUMN IF NOT EXISTS escola_id UUID;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END;

    BEGIN
      ALTER TABLE public.mensalidades
        ADD COLUMN IF NOT EXISTS turma_id UUID;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END;

    -- Ano letivo / mês / ano de referência
    BEGIN
      ALTER TABLE public.mensalidades
        ADD COLUMN IF NOT EXISTS ano_letivo TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END;

    BEGIN
      ALTER TABLE public.mensalidades
        ADD COLUMN IF NOT EXISTS mes_referencia SMALLINT;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END;

    BEGIN
      ALTER TABLE public.mensalidades
        ADD COLUMN IF NOT EXISTS ano_referencia INTEGER;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END;

    -- Valor previsto e valor pago total
    BEGIN
      ALTER TABLE public.mensalidades
        ADD COLUMN IF NOT EXISTS valor_previsto NUMERIC(14,2);
    EXCEPTION WHEN duplicate_column THEN NULL;
    END;

    BEGIN
      ALTER TABLE public.mensalidades
        ADD COLUMN IF NOT EXISTS valor_pago_total NUMERIC(14,2) DEFAULT 0;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END;

    -- Data de pagamento efetiva / observações / updated_at
    BEGIN
      ALTER TABLE public.mensalidades
        ADD COLUMN IF NOT EXISTS data_pagamento_efetiva DATE;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END;

    BEGIN
      ALTER TABLE public.mensalidades
        ADD COLUMN IF NOT EXISTS observacoes TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END;

    BEGIN
      ALTER TABLE public.mensalidades
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
    EXCEPTION WHEN duplicate_column THEN NULL;
    END;

    -- Backfill: preencher novos campos a partir do que já existe
    -- (valor_previsto a partir de valor; ano/mes a partir de data_vencimento)
    UPDATE public.mensalidades m
       SET valor_previsto   = COALESCE(m.valor_previsto, 0),
           valor_pago_total = COALESCE(m.valor_pago_total, 0),
           ano_referencia   = COALESCE(m.ano_referencia, EXTRACT(YEAR  FROM m.data_vencimento)::int),
           mes_referencia   = COALESCE(m.mes_referencia, EXTRACT(MONTH FROM m.data_vencimento)::int),
           ano_letivo       = COALESCE(m.ano_letivo,     EXTRACT(YEAR  FROM m.data_vencimento)::text)
     WHERE TRUE;

    -- Backfill de escola_id via alunos.escola_id quando possível
    UPDATE public.mensalidades m
       SET escola_id = a.escola_id
      FROM public.alunos a
     WHERE m.aluno_id  = a.id
       AND m.escola_id IS NULL
       AND a.escola_id IS NOT NULL;

    -- Normalização de status antes de aplicar o CHECK
    UPDATE public.mensalidades m
       SET status = CASE
                      WHEN status IS NULL OR btrim(status::text) = '' THEN 'pendente'
                      WHEN lower(btrim(status::text)) IN ('pendente','pago_parcial','pago','isento','cancelado')
                        THEN lower(btrim(status::text))::mensalidade_status
                      ELSE 'pendente'
                    END;

    -- Constraint de status baseado na lista canônica
    ALTER TABLE public.mensalidades
      DROP CONSTRAINT IF EXISTS mensalidades_status_check;

    ALTER TABLE public.mensalidades
      ADD CONSTRAINT mensalidades_status_check
      CHECK (status IN ('pendente','pago_parcial','pago','isento','cancelado'));
  END IF;
END
$$;

-- Índices úteis (idempotentes)
CREATE INDEX IF NOT EXISTS idx_mensalidades_escola
  ON public.mensalidades(escola_id);

CREATE INDEX IF NOT EXISTS idx_mensalidades_aluno
  ON public.mensalidades(aluno_id);

CREATE INDEX IF NOT EXISTS idx_mensalidades_status_vencimento
  ON public.mensalidades(status, data_vencimento);

-- RLS multi-tenant (idempotente)
ALTER TABLE public.mensalidades ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'mensalidades'
       AND policyname = 'Mensalidades - Tenant Isolation'
  ) THEN
    CREATE POLICY "Mensalidades - Tenant Isolation"
    ON public.mensalidades
    USING (escola_id = public.current_tenant_escola_id())
    WITH CHECK (escola_id = public.current_tenant_escola_id());
  END IF;
END
$$;

------------------------------------------------------------
-- 3) Alinhamento da tabela pagamentos aos usos do app
------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.pagamentos') IS NOT NULL THEN
    -- Chave com mensalidades
    BEGIN
      ALTER TABLE public.pagamentos
        ADD COLUMN IF NOT EXISTS mensalidade_id UUID REFERENCES public.mensalidades(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    -- Campos operacionais usados por integrações (MCX / conciliação)
    BEGIN
      ALTER TABLE public.pagamentos
        ADD COLUMN IF NOT EXISTS valor_pago NUMERIC(14,2);
    EXCEPTION WHEN duplicate_column THEN NULL; END;

    BEGIN
      ALTER TABLE public.pagamentos
        ADD COLUMN IF NOT EXISTS metodo_pagamento TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL; END;

    BEGIN
      ALTER TABLE public.pagamentos
        ADD COLUMN IF NOT EXISTS telemovel_origem TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL; END;

    BEGIN
      ALTER TABLE public.pagamentos
        ADD COLUMN IF NOT EXISTS transacao_id_externo TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL; END;

    BEGIN
      ALTER TABLE public.pagamentos
        ADD COLUMN IF NOT EXISTS data_pagamento TIMESTAMPTZ;
    EXCEPTION WHEN duplicate_column THEN NULL; END;

    BEGIN
      ALTER TABLE public.pagamentos
        ADD COLUMN IF NOT EXISTS conciliado BOOLEAN NOT NULL DEFAULT false;
    EXCEPTION WHEN duplicate_column THEN NULL; END;
  END IF;
END$$;

------------------------------------------------------------
-- 4) View de Inadimplência (Radar)
--    Compatível com colunas reais de alunos e mensalidades
------------------------------------------------------------
DROP VIEW IF EXISTS public.vw_radar_inadimplencia;
CREATE OR REPLACE VIEW public.vw_radar_inadimplencia
WITH (security_invoker = true)
AS
SELECT
  m.id                                             AS mensalidade_id,
  m.aluno_id                                       AS aluno_id,
  a.nome                                           AS nome_aluno,
  -- aqui usamos exatamente o que existe hoje em public.alunos
  a.responsavel_nome                               AS responsavel,
  a.responsavel_contato                            AS telefone,
  t.nome                                           AS nome_turma,
    -- Nomes projetados para o frontend/API
  COALESCE(m.valor_previsto, 0)::numeric(10,2)     AS valor_previsto,     -- mantém 10,2 (já era assim)
  COALESCE(m.valor_pago_total, 0)::numeric        AS valor_pago_total,    -- bate com o tipo atual da view
  GREATEST(0, COALESCE(m.valor_previsto,0) - COALESCE(m.valor_pago_total,0))::numeric AS valor_em_atraso,
  m.data_vencimento                                AS data_vencimento,
  GREATEST(0, (CURRENT_DATE - m.data_vencimento))::int AS dias_em_atraso,
  CASE
    WHEN (CURRENT_DATE - m.data_vencimento) >= 30 THEN 'critico'
    WHEN (CURRENT_DATE - m.data_vencimento) >= 10 THEN 'atencao'
    ELSE 'recente'
  END                                              AS status_risco,
  m.status::text                                   AS status_mensalidade
FROM public.mensalidades m
JOIN public.alunos a
  ON a.id = m.aluno_id
LEFT JOIN public.matriculas mat
  ON mat.aluno_id = m.aluno_id
 AND (mat.status IN ('ativo','ativa') OR mat.ativo = true)
LEFT JOIN public.turmas t
  ON t.id = mat.turma_id
WHERE m.escola_id = public.current_tenant_escola_id()
  AND m.status IN ('pendente','pago_parcial')
  AND m.data_vencimento < CURRENT_DATE;

GRANT SELECT ON TABLE public.vw_radar_inadimplencia TO anon, authenticated, service_role;
-- 5) Visão: Total em aberto por mês
------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_total_em_aberto_por_mes
WITH (security_invoker = true)
AS
SELECT
  m.escola_id,
  m.ano_referencia AS ano,
  m.mes_referencia AS mes,
  SUM(
    GREATEST(
      0,
      COALESCE(m.valor_previsto, 0)
      - COALESCE(m.valor_pago_total, 0)
    )
  )::numeric(14,2) AS total_aberto
FROM public.mensalidades m
WHERE m.escola_id = public.current_tenant_escola_id()
  AND m.status IN ('pendente','pago_parcial')
GROUP BY m.escola_id, m.ano_referencia, m.mes_referencia
ORDER BY ano, mes;

GRANT SELECT ON TABLE public.v_total_em_aberto_por_mes TO anon, authenticated, service_role;
