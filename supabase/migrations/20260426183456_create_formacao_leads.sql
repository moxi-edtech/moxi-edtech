BEGIN;

CREATE TABLE IF NOT EXISTS public.formacao_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id UUID NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
    cohort_id UUID NOT NULL REFERENCES public.formacao_cohorts(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    telefone TEXT NOT NULL,
    email TEXT,
    origem TEXT DEFAULT 'landing_page_oportunidade',
    status TEXT DEFAULT 'NOVO',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.formacao_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable insert for everyone" ON public.formacao_leads
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable select for school admins" ON public.formacao_leads
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.escola_administradores
            WHERE escola_id = public.formacao_leads.escola_id
              AND user_id = auth.uid()
        )
    );

COMMIT;
