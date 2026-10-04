BEGIN;

CREATE INDEX IF NOT EXISTS idx_fin_pag_aloc_escola
  ON public.financeiro_pagamento_alocacoes(escola_id);

CREATE INDEX IF NOT EXISTS idx_fin_pag_aloc_mensalidade
  ON public.financeiro_pagamento_alocacoes(mensalidade_id)
  WHERE mensalidade_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fin_pag_reversoes_escola
  ON public.financeiro_pagamento_reversoes(escola_id);

CREATE INDEX IF NOT EXISTS idx_fin_estornos_pagamento
  ON public.financeiro_estornos(pagamento_id)
  WHERE pagamento_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fin_estornos_alocacao
  ON public.financeiro_estornos(alocacao_id)
  WHERE alocacao_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fin_estornos_reversao
  ON public.financeiro_estornos(reversao_id)
  WHERE reversao_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fin_recibo_aloc_escola
  ON public.financeiro_recibo_alocacoes(escola_id);

CREATE INDEX IF NOT EXISTS idx_fin_recibo_aloc_source
  ON public.financeiro_recibo_alocacoes(fiscal_documento_origem_id);

CREATE INDEX IF NOT EXISTS idx_pagamentos_fiscal_documento
  ON public.pagamentos(fiscal_documento_id)
  WHERE fiscal_documento_id IS NOT NULL;

DROP POLICY IF EXISTS financeiro_pagamento_alocacoes_select
ON public.financeiro_pagamento_alocacoes;
CREATE POLICY financeiro_pagamento_alocacoes_select
ON public.financeiro_pagamento_alocacoes
FOR SELECT TO authenticated
USING (
  (select public.is_super_admin())
  OR escola_id = (select public.current_tenant_escola_id())
  OR EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.escola_id = financeiro_pagamento_alocacoes.escola_id
      AND eu.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS financeiro_pagamento_reversoes_select
ON public.financeiro_pagamento_reversoes;
CREATE POLICY financeiro_pagamento_reversoes_select
ON public.financeiro_pagamento_reversoes
FOR SELECT TO authenticated
USING (
  (select public.is_super_admin())
  OR escola_id = (select public.current_tenant_escola_id())
  OR EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.escola_id = financeiro_pagamento_reversoes.escola_id
      AND eu.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS financeiro_recibo_alocacoes_select
ON public.financeiro_recibo_alocacoes;
CREATE POLICY financeiro_recibo_alocacoes_select
ON public.financeiro_recibo_alocacoes
FOR SELECT TO authenticated
USING (
  (select public.is_super_admin())
  OR escola_id = (select public.current_tenant_escola_id())
  OR EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.escola_id = financeiro_recibo_alocacoes.escola_id
      AND eu.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS financeiro_ledger_select
ON public.financeiro_ledger;
CREATE POLICY financeiro_ledger_select
ON public.financeiro_ledger
FOR SELECT TO authenticated
USING (
  (select public.is_super_admin())
  OR escola_id = (select public.current_tenant_escola_id())
  OR EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.escola_id = financeiro_ledger.escola_id
      AND eu.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS financeiro_estornos_select
ON public.financeiro_estornos;
CREATE POLICY financeiro_estornos_select
ON public.financeiro_estornos
FOR SELECT TO authenticated
USING (
  (select public.is_super_admin())
  OR escola_id = (select public.current_tenant_escola_id())
  OR EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.escola_id = financeiro_estornos.escola_id
      AND eu.user_id = (select auth.uid())
  )
);

COMMIT;