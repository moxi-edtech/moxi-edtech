-- Production-derived finance integration contract. All identities, values, and
-- documents are synthetic; NEVER connect this test to a hosted Supabase DB.
-- Column names/types and enum labels were checked against live PostgreSQL 17
-- catalog on 2026-10-23. This is not a full production schema or RLS clone.
\set ON_ERROR_STOP on
CREATE TYPE public.financeiro_status AS ENUM ('pendente','pago','parcial','vencido','cancelado');
CREATE TYPE public.metodo_pagamento_enum AS ENUM ('numerario','multicaixa','transferencia','deposito');
CREATE TYPE public.financeiro_origem AS ENUM ('mensalidade','matricula','venda_avulsa','multa','taxa_extra','estorno','ajuste','servico_balcao');
CREATE TYPE public.financeiro_tipo_transacao AS ENUM ('debito','credito');
CREATE TYPE public.financeiro_categoria_item AS ENUM ('uniforme','documento','material','transporte','outros','servico');

-- Additional live columns used by the real fiscal/finance allocation function.
ALTER TABLE public.pagamentos
  ADD COLUMN aluno_id uuid,
  ADD COLUMN created_by uuid,
  ADD COLUMN metodo text NOT NULL DEFAULT 'cash',
  ADD COLUMN metodo_pagamento text,
  ADD COLUMN data_pagamento date;
ALTER TABLE public.mensalidades
  ADD COLUMN fiscal_documento_id uuid,
  ADD COLUMN matricula_id uuid,
  ADD COLUMN ano_referencia integer,
  ADD COLUMN mes_referencia smallint,
  ADD COLUMN metodo_pagamento text;
ALTER TABLE public.mensalidades
  ALTER COLUMN valor TYPE numeric(10,2),
  ALTER COLUMN valor_previsto TYPE numeric(14,2),
  ALTER COLUMN valor_pago_total TYPE numeric(14,2);
ALTER TABLE public.pagamentos ALTER COLUMN valor_pago TYPE numeric(10,2);

CREATE TABLE public.fiscal_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  tipo_documento text NOT NULL,
  status text NOT NULL,
  total_bruto_aoa numeric(18,4) NOT NULL,
  total_liquido_aoa numeric(18,4) NOT NULL,
  total_impostos_aoa numeric(18,4) NOT NULL,
  numero_formatado text NOT NULL
);
CREATE TABLE public.financeiro_pagamento_alocacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  pagamento_id uuid NOT NULL,
  mensalidade_id uuid,
  fiscal_documento_origem_id uuid,
  natureza text NOT NULL CHECK (natureza IN ('aplicacao','estorno')),
  valor_bruto_aoa numeric(18,2) NOT NULL,
  valor_liquido_aoa numeric(18,2),
  valor_imposto_aoa numeric(18,2),
  idempotency_key text NOT NULL UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pagamento_id,mensalidade_id,natureza)
);
CREATE TABLE public.financeiro_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  aluno_id uuid NOT NULL,
  matricula_id uuid,
  origem public.financeiro_origem NOT NULL,
  tipo public.financeiro_tipo_transacao NOT NULL,
  status public.financeiro_status,
  ano_referencia integer,
  mes_referencia integer,
  descricao text NOT NULL DEFAULT 'synthetic',
  valor_original numeric(12,2) NOT NULL DEFAULT 0,
  valor_total numeric(12,2) NOT NULL DEFAULT 0,
  metodo_pagamento public.metodo_pagamento_enum,
  data_pagamento timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz,
  categoria public.financeiro_categoria_item NOT NULL DEFAULT 'outros'
);
CREATE TABLE public.audit_logs (
  id bigserial PRIMARY KEY,
  escola_id uuid,
  actor_id uuid,
  action text,
  entity text,
  entity_id text,
  portal text,
  details jsonb,
  before jsonb,
  after jsonb
);

-- The actual production allocation function requires matching student/tenant ids.
UPDATE public.pagamentos p SET aluno_id=m.aluno_id
FROM public.mensalidades m WHERE p.mensalidade_id=m.id;
UPDATE public.mensalidades SET ano_referencia=2026,mes_referencia=9;
INSERT INTO public.financeiro_lancamentos
  (escola_id,aluno_id,origem,tipo,status,ano_referencia,mes_referencia)
SELECT escola_id,aluno_id,'mensalidade','debito','pendente',ano_referencia,mes_referencia
FROM public.mensalidades WHERE id='00000000-0000-4000-8000-000000000a16';

-- Synthetic invoice, with actual net/tax split exercised by the real allocator.
INSERT INTO public.fiscal_documentos
 (id,empresa_id,tipo_documento,status,total_bruto_aoa,total_liquido_aoa,total_impostos_aoa,numero_formatado)
VALUES
 ('00000000-0000-4000-8000-000000000a40','00000000-0000-4000-8000-000000000a41',
  'FT','emitido',100,90,10,'FT-SYNTHETIC-001');
UPDATE public.mensalidades SET fiscal_documento_id='00000000-0000-4000-8000-000000000a40'
WHERE id='00000000-0000-4000-8000-000000000a16';

-- The allocator below is pg_get_functiondef from production, not a stub.
\ir finance_validator_production_allocator.sql

-- The deployed fiscal allocator is verified byte-for-byte via pg_get_functiondef
-- before running any synthetic financial test.
DO $production_allocator_fingerprint$
BEGIN
 IF md5(pg_get_functiondef('public.financeiro_aplicar_pagamento_existente(uuid,uuid)'::regprocedure))
    <> '9f4e1e0e785828c5b354056a428f38f5' THEN
   RAISE EXCEPTION 'PRODUCTION_ALLOCATOR_BASELINE_CHANGED';
 END IF;
END $production_allocator_fingerprint$;

ALTER TABLE public.pagamentos FORCE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_pagamento_alocacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_documentos FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY production_allocator_school_isolation
 ON public.financeiro_pagamento_alocacoes FOR SELECT TO authenticated
 USING (escola_id = public.current_tenant_escola_id());
CREATE POLICY financial_ledger_school_isolation
 ON public.financeiro_lancamentos FOR SELECT TO authenticated
 USING (escola_id = public.current_tenant_escola_id());
CREATE POLICY financial_audit_school_isolation
 ON public.audit_logs FOR SELECT TO authenticated
 USING (escola_id = public.current_tenant_escola_id());
GRANT SELECT ON public.financeiro_pagamento_alocacoes,
  public.financeiro_lancamentos,public.audit_logs TO authenticated;
