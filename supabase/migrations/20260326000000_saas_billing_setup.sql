-- Migration: 20260326000000_saas_billing_setup.sql
-- Descrição: Criação das tabelas de gestão de assinaturas e pagamentos SaaS Klasse

-- 1. Tabela de Assinaturas por Escola
CREATE TABLE IF NOT EXISTS public.assinaturas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id       UUID NOT NULL REFERENCES public.escolas(id),
  plano           public.app_plan_tier NOT NULL DEFAULT 'essencial',
  ciclo           TEXT NOT NULL CHECK (ciclo IN ('mensal','anual')),
  status          TEXT NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente','activa','suspensa','cancelada')),
  metodo_pagamento TEXT NOT NULL
                  CHECK (metodo_pagamento IN ('transferencia','multicaixa','cartao','stripe')),
  data_inicio     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_renovacao  TIMESTAMPTZ NOT NULL,
  valor_kz        INTEGER NOT NULL,  -- valor em kwanzas (inteiro para evitar problemas de ponto flutuante)
  stripe_subscription_id TEXT,       -- ID da subscrição no Stripe
  stripe_customer_id     TEXT,       -- ID do cliente no Stripe
  multicaixa_referencia  TEXT,       -- Referência gerada para Multicaixa Express
  notas_internas  TEXT,              -- Notas de uso interno da Klasse
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Histórico de Pagamentos SaaS (Audit Trail Financeiro)
CREATE TABLE IF NOT EXISTS public.pagamentos_saas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assinatura_id   UUID NOT NULL REFERENCES public.assinaturas(id),
  escola_id       UUID NOT NULL REFERENCES public.escolas(id),
  valor_kz        INTEGER NOT NULL,
  metodo          TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('pendente','confirmado','falhado')),
  referencia_ext  TEXT,   -- ID do Stripe, Ref Multicaixa ou Nº do Comprovativo
  comprovativo_url TEXT,  -- URL do ficheiro de comprovativo (Storage)
  confirmado_por  UUID REFERENCES auth.users(id),  -- Admin Klasse que validou o pagamento manual
  confirmado_em   TIMESTAMPTZ,
  periodo_inicio  DATE NOT NULL,
  periodo_fim     DATE NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Segurança (Row Level Security)
ALTER TABLE public.assinaturas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos_saas ENABLE ROW LEVEL SECURITY;

-- Políticas para Escolas (Acesso aos seus próprios dados de billing)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'escola_propria_assinatura' AND tablename = 'assinaturas') THEN
    CREATE POLICY escola_propria_assinatura ON public.assinaturas
      FOR SELECT USING (escola_id = public.current_tenant_escola_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'escola_propria_pagamentos_saas' AND tablename = 'pagamentos_saas') THEN
    CREATE POLICY escola_propria_pagamentos_saas ON public.pagamentos_saas
      FOR SELECT USING (escola_id = public.current_tenant_escola_id());
  END IF;
END $$;

-- Políticas para Super Admin (Gestão Global)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super_admin_all_assinaturas' AND tablename = 'assinaturas') THEN
    CREATE POLICY super_admin_all_assinaturas ON public.assinaturas
      FOR ALL USING (public.check_super_admin_role());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'super_admin_all_pagamentos_saas' AND tablename = 'pagamentos_saas') THEN
    CREATE POLICY super_admin_all_pagamentos_saas ON public.pagamentos_saas
      FOR ALL USING (public.check_super_admin_role());
  END IF;
END $$;

-- 4. Triggers para updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_assinaturas_updated') THEN
    CREATE TRIGGER trg_assinaturas_updated
      BEFORE UPDATE ON public.assinaturas
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- 5. Documentação
COMMENT ON TABLE public.assinaturas IS 'Gestão de subscrições das escolas no ecossistema Klasse SaaS';
COMMENT ON TABLE public.pagamentos_saas IS 'Registo histórico de fluxos financeiros de subscrição das escolas';
