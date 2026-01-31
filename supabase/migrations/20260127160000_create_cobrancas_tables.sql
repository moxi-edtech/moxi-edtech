-- supabase/migrations/20260127160000_create_cobrancas_tables.sql

-- Table for Message Templates
CREATE TABLE public.financeiro_templates_mensagem (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id UUID NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    canal TEXT NOT NULL CHECK (canal IN ('whatsapp', 'sms', 'email')),
    conteudo TEXT NOT NULL,
    variaveis TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table for Collection Campaigns
CREATE TABLE public.financeiro_campanhas_cobranca (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id UUID NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    canal TEXT NOT NULL CHECK (canal IN ('whatsapp', 'sms', 'email', 'push')),
    template_id UUID REFERENCES public.financeiro_templates_mensagem(id),
    destinatarios_stats JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL CHECK (status IN ('rascunho', 'agendada', 'enviando', 'concluida', 'pausada')) DEFAULT 'rascunho',
    data_agendamento TIMESTAMPTZ NOT NULL,
    data_envio TIMESTAMPTZ,
    criado_por UUID REFERENCES auth.users(id),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policies for Templates
ALTER TABLE public.financeiro_templates_mensagem ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Can manage own school templates" ON public.financeiro_templates_mensagem
FOR ALL TO authenticated USING (escola_id = public.current_tenant_escola_id()) WITH CHECK (escola_id = public.current_tenant_escola_id());

-- RLS Policies for Campaigns
ALTER TABLE public.financeiro_campanhas_cobranca ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Can manage own school campaigns" ON public.financeiro_campanhas_cobranca
FOR ALL TO authenticated USING (escola_id = public.current_tenant_escola_id()) WITH CHECK (escola_id = public.current_tenant_escola_id());
