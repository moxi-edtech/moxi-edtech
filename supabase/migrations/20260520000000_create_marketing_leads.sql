BEGIN;

CREATE TABLE IF NOT EXISTS public.marketing_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    escola TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    email TEXT NOT NULL,
    score INTEGER NOT NULL,
    respostas_json JSONB,
    origem TEXT DEFAULT 'diagnostico_gestao',
    status TEXT DEFAULT 'NOVO',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;

-- Permitir inserção pública (para o funil de marketing)
CREATE POLICY "Enable insert for everyone" ON public.marketing_leads
    FOR INSERT WITH CHECK (true);

-- Permitir leitura apenas para super admins
CREATE POLICY "Enable select for super admins" ON public.marketing_leads
    FOR SELECT USING (public.is_super_admin());

COMMIT;
