-- Migration: Funil de Inscrições Públicas (Quarentena)
-- Data: 11/04/2026

-- 1. Tabela de Quarentena
CREATE TABLE IF NOT EXISTS public.formacao_inscricoes_staging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id UUID NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
    cohort_id UUID NOT NULL REFERENCES public.formacao_cohorts(id) ON DELETE CASCADE,
    
    -- Dados brutos (Untrusted)
    nome_completo TEXT NOT NULL CHECK (char_length(nome_completo) >= 3),
    bi_passaporte TEXT NOT NULL CHECK (char_length(bi_passaporte) >= 6),
    email TEXT CHECK (email ~* '^[A-Za-z0-9._+%-]+@[A-Za-z0-9.-]+[.][A-Za-z]+$'),
    telefone TEXT NOT NULL CHECK (telefone ~* '^[0-9\+\-\s]+$'),
    
    -- O Talão (URL do Storage)
    comprovativo_url TEXT NOT NULL,
    
    -- Estado do Funil
    status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE' 
        CHECK (status IN ('PENDENTE', 'APROVADA', 'REJEITADA')),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_formacao_staging_cohort ON public.formacao_inscricoes_staging(cohort_id);
CREATE INDEX IF NOT EXISTS idx_formacao_staging_status ON public.formacao_inscricoes_staging(status);
CREATE INDEX IF NOT EXISTS idx_formacao_staging_escola ON public.formacao_inscricoes_staging(escola_id);

-- 3. RLS
ALTER TABLE public.formacao_inscricoes_staging ENABLE ROW LEVEL SECURITY;

-- Política de Inserção Pública (Anon)
DROP POLICY IF EXISTS "Permitir submissão pública de inscrições" ON public.formacao_inscricoes_staging;
CREATE POLICY "Permitir submissão pública de inscrições" 
ON public.formacao_inscricoes_staging 
FOR INSERT 
TO anon, authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.formacao_cohorts c
        WHERE c.id = cohort_id 
        AND c.escola_id = escola_id 
        -- Em fase de MVP, permitimos a submissão se a cohort estiver planeada ou em andamento
        AND (c.status = 'planeada' OR c.status = 'em_andamento' OR c.status = 'aberta')
        -- Verificação de vagas via contagem real na tabela de inscrições oficiais
        AND (
            SELECT count(*) FROM public.formacao_inscricoes 
            WHERE cohort_id = c.id
        ) < c.vagas
    )
);

-- Política de Gestão (Secretaria/Admin)
DROP POLICY IF EXISTS "Gestores gerem as suas próprias inscrições staging" ON public.formacao_inscricoes_staging;
CREATE POLICY "Gestores gerem as suas próprias inscrições staging"
ON public.formacao_inscricoes_staging
FOR ALL
TO authenticated
USING (
    escola_id IN (SELECT escola_id FROM public.escola_users WHERE user_id = auth.uid())
);

-- 4. Bucket de Comprovativos (Storage)
-- Nota: O bucket deve ser criado via painel ou script admin. 
-- Nome sugerido: "formacao-comprovativos"
