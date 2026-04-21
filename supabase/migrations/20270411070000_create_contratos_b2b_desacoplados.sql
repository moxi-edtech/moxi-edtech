-- Migration: Gestão B2B Desacoplada (Solo Creator)
-- Data: 11/04/2026

CREATE TABLE IF NOT EXISTS public.formacao_contratos_b2b (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id UUID NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
    cohort_id UUID NOT NULL REFERENCES public.formacao_cohorts(id) ON DELETE CASCADE,
    
    -- Dados do Cliente Corporativo
    empresa_nome TEXT NOT NULL,
    empresa_nif TEXT NOT NULL,
    
    -- O Acordo
    vagas_compradas INTEGER NOT NULL CHECK (vagas_compradas > 0),
    vagas_utilizadas INTEGER NOT NULL DEFAULT 0,
    valor_total DECIMAL(12,2) NOT NULL,
    
    -- A Ponte para o Software Externo (O Segredo do Desacoplamento)
    fatura_externa_ref TEXT, -- Ex: "FT 2026/045" (Referência do Primavera/Software do Coach)
    
    -- Link Mágico
    b2b_token TEXT UNIQUE NOT NULL,
    
    status VARCHAR(20) DEFAULT 'AGUARDA_PAGAMENTO' 
        CHECK (status IN ('AGUARDA_PAGAMENTO', 'PAGO', 'CANCELADO')),
        
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para triagem rápida
CREATE INDEX IF NOT EXISTS idx_contratos_b2b_escola ON public.formacao_contratos_b2b(escola_id);
CREATE INDEX IF NOT EXISTS idx_contratos_b2b_token ON public.formacao_contratos_b2b(b2b_token);
CREATE INDEX IF NOT EXISTS idx_contratos_b2b_status ON public.formacao_contratos_b2b(status);

-- RLS
ALTER TABLE public.formacao_contratos_b2b ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestores gerem os seus contratos B2B"
ON public.formacao_contratos_b2b
FOR ALL
TO authenticated
USING (
    escola_id IN (SELECT escola_id FROM public.escola_users WHERE user_id = auth.uid())
);
