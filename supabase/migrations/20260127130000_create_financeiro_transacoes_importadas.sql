-- supabase/migrations/20260127130000_create_financeiro_transacoes_importadas.sql
CREATE TABLE public.financeiro_transacoes_importadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id UUID NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
    import_id UUID, -- To group transactions from the same file import
    data DATE NOT NULL,
    descricao TEXT,
    referencia TEXT,
    valor NUMERIC(14,2) NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('credito', 'debito')),
    banco TEXT NOT NULL,
    conta TEXT,
    status TEXT NOT NULL CHECK (status IN ('pendente', 'conciliado', 'ignorado')) DEFAULT 'pendente',
    match_confianca INTEGER DEFAULT 0, -- Percentage 0-100
    aluno_match_details JSONB, -- Stores student/mensalidade match details
    raw_data JSONB, -- Stores raw data from the imported file for debugging/reprocessing

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_financeiro_transacoes_escola_id ON public.financeiro_transacoes_importadas (escola_id);
CREATE INDEX idx_financeiro_transacoes_status ON public.financeiro_transacoes_importadas (status);
CREATE INDEX idx_financeiro_transacoes_data ON public.financeiro_transacoes_importadas (data);
