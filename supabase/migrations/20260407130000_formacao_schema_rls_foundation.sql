-- Ticket 3 — Base de Dados Formação (schema + RLS + views de abstração)

-- =========================
-- Helpers de autorização
-- =========================
CREATE OR REPLACE FUNCTION public.can_access_formacao_backoffice(p_escola_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_role_in_school(
    p_escola_id,
    ARRAY[
      'formacao_admin',
      'formacao_secretaria',
      'formacao_financeiro',
      'admin',
      'admin_escola',
      'staff_admin',
      'super_admin',
      'global_admin'
    ]
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_formacao_cohort_as_formador(
  p_escola_id uuid,
  p_cohort_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.user_has_role_in_school(p_escola_id, ARRAY['formador'])
    AND EXISTS (
      SELECT 1
      FROM public.formacao_cohort_formadores fcf
      WHERE fcf.escola_id = p_escola_id
        AND fcf.cohort_id = p_cohort_id
        AND fcf.formador_user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_formacao_fatura_as_formando(
  p_escola_id uuid,
  p_formando_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.user_has_role_in_school(p_escola_id, ARRAY['formando'])
    AND p_formando_user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.can_access_formacao_backoffice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_formacao_cohort_as_formador(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_formacao_fatura_as_formando(uuid, uuid) TO authenticated;

-- =========================
-- Cohorts (edições)
-- =========================
CREATE TABLE IF NOT EXISTS public.formacao_cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nome text NOT NULL,
  curso_nome text NOT NULL,
  carga_horaria_total integer NOT NULL CHECK (carga_horaria_total > 0),
  vagas integer NOT NULL CHECK (vagas > 0),
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  status text NOT NULL DEFAULT 'planeada' CHECK (status IN ('planeada', 'em_andamento', 'concluida', 'cancelada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT formacao_cohorts_data_range_ck CHECK (data_fim >= data_inicio),
  CONSTRAINT formacao_cohorts_codigo_unique UNIQUE (escola_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_formacao_cohorts_escola_id
  ON public.formacao_cohorts(escola_id);
CREATE INDEX IF NOT EXISTS idx_formacao_cohorts_escola_status
  ON public.formacao_cohorts(escola_id, status);

CREATE TABLE IF NOT EXISTS public.formacao_cohort_formadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  cohort_id uuid NOT NULL REFERENCES public.formacao_cohorts(id) ON DELETE CASCADE,
  formador_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  percentual_honorario numeric(5,2) NOT NULL DEFAULT 100.00 CHECK (percentual_honorario > 0 AND percentual_honorario <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT formacao_cohort_formadores_unique UNIQUE (escola_id, cohort_id, formador_user_id)
);

CREATE INDEX IF NOT EXISTS idx_formacao_cohort_formadores_escola_id
  ON public.formacao_cohort_formadores(escola_id);
CREATE INDEX IF NOT EXISTS idx_formacao_cohort_formadores_user
  ON public.formacao_cohort_formadores(escola_id, formador_user_id);
CREATE INDEX IF NOT EXISTS idx_formacao_cohort_formadores_cohort
  ON public.formacao_cohort_formadores(escola_id, cohort_id);

-- =========================
-- Clientes B2B e faturação em lote
-- =========================
CREATE TABLE IF NOT EXISTS public.formacao_clientes_b2b (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  nome_fantasia text NOT NULL,
  razao_social text,
  nif text,
  email_financeiro text,
  telefone text,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_formacao_clientes_b2b_escola_id
  ON public.formacao_clientes_b2b(escola_id);
CREATE INDEX IF NOT EXISTS idx_formacao_clientes_b2b_escola_status
  ON public.formacao_clientes_b2b(escola_id, status);

CREATE TABLE IF NOT EXISTS public.formacao_faturas_lote (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  cliente_b2b_id uuid NOT NULL REFERENCES public.formacao_clientes_b2b(id) ON DELETE RESTRICT,
  cohort_id uuid REFERENCES public.formacao_cohorts(id) ON DELETE SET NULL,
  referencia text NOT NULL,
  emissao_em date NOT NULL DEFAULT current_date,
  vencimento_em date NOT NULL,
  moeda text NOT NULL DEFAULT 'AOA',
  total_bruto numeric(14,2) NOT NULL DEFAULT 0,
  total_desconto numeric(14,2) NOT NULL DEFAULT 0,
  total_liquido numeric(14,2) GENERATED ALWAYS AS (total_bruto - total_desconto) STORED,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'emitida', 'parcial', 'paga', 'cancelada')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT formacao_faturas_lote_ref_unique UNIQUE (escola_id, referencia),
  CONSTRAINT formacao_faturas_lote_totais_ck CHECK (total_bruto >= 0 AND total_desconto >= 0 AND total_desconto <= total_bruto)
);

CREATE INDEX IF NOT EXISTS idx_formacao_faturas_lote_escola_id
  ON public.formacao_faturas_lote(escola_id);
CREATE INDEX IF NOT EXISTS idx_formacao_faturas_lote_cliente
  ON public.formacao_faturas_lote(escola_id, cliente_b2b_id);
CREATE INDEX IF NOT EXISTS idx_formacao_faturas_lote_status
  ON public.formacao_faturas_lote(escola_id, status, vencimento_em);

CREATE TABLE IF NOT EXISTS public.formacao_faturas_lote_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  fatura_lote_id uuid NOT NULL REFERENCES public.formacao_faturas_lote(id) ON DELETE CASCADE,
  formando_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  quantidade numeric(12,2) NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  preco_unitario numeric(14,2) NOT NULL CHECK (preco_unitario >= 0),
  desconto numeric(14,2) NOT NULL DEFAULT 0 CHECK (desconto >= 0),
  valor_total numeric(14,2) GENERATED ALWAYS AS ((quantidade * preco_unitario) - desconto) STORED,
  status_pagamento text NOT NULL DEFAULT 'pendente' CHECK (status_pagamento IN ('pendente', 'parcial', 'pago', 'cancelado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT formacao_faturas_lote_itens_valor_ck CHECK (desconto <= (quantidade * preco_unitario))
);

CREATE INDEX IF NOT EXISTS idx_formacao_faturas_lote_itens_escola_id
  ON public.formacao_faturas_lote_itens(escola_id);
CREATE INDEX IF NOT EXISTS idx_formacao_faturas_lote_itens_fatura
  ON public.formacao_faturas_lote_itens(escola_id, fatura_lote_id);
CREATE INDEX IF NOT EXISTS idx_formacao_faturas_lote_itens_formando
  ON public.formacao_faturas_lote_itens(escola_id, formando_user_id, status_pagamento);

-- =========================
-- Honorários dos formadores
-- =========================
CREATE TABLE IF NOT EXISTS public.formacao_honorarios_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  cohort_id uuid NOT NULL REFERENCES public.formacao_cohorts(id) ON DELETE RESTRICT,
  formador_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  referencia text NOT NULL,
  horas_ministradas numeric(10,2) NOT NULL CHECK (horas_ministradas >= 0),
  valor_hora numeric(14,2) NOT NULL CHECK (valor_hora >= 0),
  bonus numeric(14,2) NOT NULL DEFAULT 0 CHECK (bonus >= 0),
  desconto numeric(14,2) NOT NULL DEFAULT 0 CHECK (desconto >= 0),
  valor_bruto numeric(14,2) GENERATED ALWAYS AS (horas_ministradas * valor_hora) STORED,
  valor_liquido numeric(14,2) GENERATED ALWAYS AS ((horas_ministradas * valor_hora) + bonus - desconto) STORED,
  competencia date NOT NULL,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'aprovado', 'pago', 'cancelado')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT formacao_honorarios_lancamentos_ref_unique UNIQUE (escola_id, referencia),
  CONSTRAINT formacao_honorarios_lancamentos_liquido_ck CHECK (((horas_ministradas * valor_hora) + bonus - desconto) >= 0)
);

CREATE INDEX IF NOT EXISTS idx_formacao_honorarios_lancamentos_escola_id
  ON public.formacao_honorarios_lancamentos(escola_id);
CREATE INDEX IF NOT EXISTS idx_formacao_honorarios_lancamentos_formador
  ON public.formacao_honorarios_lancamentos(escola_id, formador_user_id, competencia DESC);
CREATE INDEX IF NOT EXISTS idx_formacao_honorarios_lancamentos_cohort
  ON public.formacao_honorarios_lancamentos(escola_id, cohort_id);

-- =========================
-- RLS hard isolation
-- =========================
ALTER TABLE public.formacao_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formacao_cohort_formadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formacao_clientes_b2b ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formacao_faturas_lote ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formacao_faturas_lote_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formacao_honorarios_lancamentos ENABLE ROW LEVEL SECURITY;

-- Cohorts
DROP POLICY IF EXISTS formacao_cohorts_select_policy ON public.formacao_cohorts;
CREATE POLICY formacao_cohorts_select_policy
  ON public.formacao_cohorts
  FOR SELECT
  USING (
    escola_id = public.current_tenant_escola_id()
    AND (
      public.can_access_formacao_backoffice(escola_id)
      OR public.can_access_formacao_cohort_as_formador(escola_id, id)
    )
  );

DROP POLICY IF EXISTS formacao_cohorts_mutation_policy ON public.formacao_cohorts;
CREATE POLICY formacao_cohorts_mutation_policy
  ON public.formacao_cohorts
  FOR ALL
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.can_access_formacao_backoffice(escola_id)
  )
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.can_access_formacao_backoffice(escola_id)
  );

-- Cohort x Formadores
DROP POLICY IF EXISTS formacao_cohort_formadores_select_policy ON public.formacao_cohort_formadores;
CREATE POLICY formacao_cohort_formadores_select_policy
  ON public.formacao_cohort_formadores
  FOR SELECT
  USING (
    escola_id = public.current_tenant_escola_id()
    AND (
      public.can_access_formacao_backoffice(escola_id)
      OR formador_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS formacao_cohort_formadores_mutation_policy ON public.formacao_cohort_formadores;
CREATE POLICY formacao_cohort_formadores_mutation_policy
  ON public.formacao_cohort_formadores
  FOR ALL
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.can_access_formacao_backoffice(escola_id)
  )
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.can_access_formacao_backoffice(escola_id)
  );

-- Clientes B2B
DROP POLICY IF EXISTS formacao_clientes_b2b_select_policy ON public.formacao_clientes_b2b;
CREATE POLICY formacao_clientes_b2b_select_policy
  ON public.formacao_clientes_b2b
  FOR SELECT
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.can_access_formacao_backoffice(escola_id)
  );

DROP POLICY IF EXISTS formacao_clientes_b2b_mutation_policy ON public.formacao_clientes_b2b;
CREATE POLICY formacao_clientes_b2b_mutation_policy
  ON public.formacao_clientes_b2b
  FOR ALL
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.can_access_formacao_backoffice(escola_id)
  )
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.can_access_formacao_backoffice(escola_id)
  );

-- Faturas lote (cabeçalho): apenas backoffice
DROP POLICY IF EXISTS formacao_faturas_lote_select_policy ON public.formacao_faturas_lote;
CREATE POLICY formacao_faturas_lote_select_policy
  ON public.formacao_faturas_lote
  FOR SELECT
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.can_access_formacao_backoffice(escola_id)
  );

DROP POLICY IF EXISTS formacao_faturas_lote_mutation_policy ON public.formacao_faturas_lote;
CREATE POLICY formacao_faturas_lote_mutation_policy
  ON public.formacao_faturas_lote
  FOR ALL
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.can_access_formacao_backoffice(escola_id)
  )
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.can_access_formacao_backoffice(escola_id)
  );

-- Faturas lote itens: backoffice OU formando dono da linha
DROP POLICY IF EXISTS formacao_faturas_lote_itens_select_policy ON public.formacao_faturas_lote_itens;
CREATE POLICY formacao_faturas_lote_itens_select_policy
  ON public.formacao_faturas_lote_itens
  FOR SELECT
  USING (
    escola_id = public.current_tenant_escola_id()
    AND (
      public.can_access_formacao_backoffice(escola_id)
      OR public.can_access_formacao_fatura_as_formando(escola_id, formando_user_id)
    )
  );

DROP POLICY IF EXISTS formacao_faturas_lote_itens_mutation_policy ON public.formacao_faturas_lote_itens;
CREATE POLICY formacao_faturas_lote_itens_mutation_policy
  ON public.formacao_faturas_lote_itens
  FOR ALL
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.can_access_formacao_backoffice(escola_id)
  )
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.can_access_formacao_backoffice(escola_id)
  );

-- Honorários: backoffice ou próprio formador (somente leitura)
DROP POLICY IF EXISTS formacao_honorarios_select_policy ON public.formacao_honorarios_lancamentos;
CREATE POLICY formacao_honorarios_select_policy
  ON public.formacao_honorarios_lancamentos
  FOR SELECT
  USING (
    escola_id = public.current_tenant_escola_id()
    AND (
      public.can_access_formacao_backoffice(escola_id)
      OR (
        formador_user_id = auth.uid()
        AND public.user_has_role_in_school(escola_id, ARRAY['formador'])
      )
    )
  );

DROP POLICY IF EXISTS formacao_honorarios_mutation_policy ON public.formacao_honorarios_lancamentos;
CREATE POLICY formacao_honorarios_mutation_policy
  ON public.formacao_honorarios_lancamentos
  FOR ALL
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.can_access_formacao_backoffice(escola_id)
  )
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.can_access_formacao_backoffice(escola_id)
  );

-- =========================
-- Views de abstração para UI/API
-- =========================
CREATE OR REPLACE VIEW public.vw_formacao_cohorts_overview AS
SELECT
  c.id,
  c.escola_id,
  c.codigo,
  c.nome,
  c.curso_nome,
  c.carga_horaria_total,
  c.vagas,
  c.data_inicio,
  c.data_fim,
  c.status,
  COUNT(DISTINCT fcf.formador_user_id) AS total_formadores
FROM public.formacao_cohorts c
LEFT JOIN public.formacao_cohort_formadores fcf
  ON fcf.escola_id = c.escola_id
 AND fcf.cohort_id = c.id
WHERE c.escola_id = public.current_tenant_escola_id()
GROUP BY
  c.id, c.escola_id, c.codigo, c.nome, c.curso_nome, c.carga_horaria_total,
  c.vagas, c.data_inicio, c.data_fim, c.status;

CREATE OR REPLACE VIEW public.vw_formacao_faturas_formando AS
SELECT
  i.id AS item_id,
  i.escola_id,
  i.formando_user_id,
  i.fatura_lote_id,
  f.referencia,
  f.emissao_em,
  f.vencimento_em,
  f.status AS status_fatura,
  i.status_pagamento,
  i.descricao,
  i.quantidade,
  i.preco_unitario,
  i.desconto,
  i.valor_total
FROM public.formacao_faturas_lote_itens i
JOIN public.formacao_faturas_lote f
  ON f.id = i.fatura_lote_id
 AND f.escola_id = i.escola_id
WHERE i.escola_id = public.current_tenant_escola_id();

CREATE OR REPLACE VIEW public.vw_formacao_honorarios_formador AS
SELECT
  h.id,
  h.escola_id,
  h.formador_user_id,
  h.cohort_id,
  c.nome AS cohort_nome,
  h.referencia,
  h.competencia,
  h.horas_ministradas,
  h.valor_hora,
  h.bonus,
  h.desconto,
  h.valor_bruto,
  h.valor_liquido,
  h.status
FROM public.formacao_honorarios_lancamentos h
LEFT JOIN public.formacao_cohorts c
  ON c.id = h.cohort_id
 AND c.escola_id = h.escola_id
WHERE h.escola_id = public.current_tenant_escola_id();

GRANT SELECT ON public.vw_formacao_cohorts_overview TO authenticated;
GRANT SELECT ON public.vw_formacao_faturas_formando TO authenticated;
GRANT SELECT ON public.vw_formacao_honorarios_formador TO authenticated;
