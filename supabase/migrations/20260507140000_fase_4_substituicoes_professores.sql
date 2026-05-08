-- Phase 4: Professor Substitution Management for K12 Turmas Evolution
-- This migration creates the table to track daily professor substitutions.

CREATE TABLE IF NOT EXISTS public.substituicoes_professores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id UUID NOT NULL REFERENCES public.escolas(id),
    turma_id UUID NOT NULL REFERENCES public.turmas(id),
    slot_id UUID NOT NULL REFERENCES public.horario_slots(id),
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    professor_id UUID NOT NULL REFERENCES public.professores(id),
    motivo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure only one substitution per slot per day for a turma
    CONSTRAINT ux_substituicao_dia_turma_slot UNIQUE (turma_id, slot_id, data)
);

-- Index for fast lookup by date and school
CREATE INDEX idx_substituicoes_escola_data ON public.substituicoes_professores (escola_id, data);

-- RLS
ALTER TABLE public.substituicoes_professores ENABLE ROW LEVEL SECURITY;

CREATE POLICY substituicoes_select ON public.substituicoes_professores
    FOR SELECT TO authenticated
    USING (escola_id = (SELECT public.current_tenant_escola_id()));

CREATE POLICY substituicoes_write ON public.substituicoes_professores
    FOR ALL TO authenticated
    USING (escola_id = (SELECT public.current_tenant_escola_id()))
    WITH CHECK (escola_id = (SELECT public.current_tenant_escola_id()));

-- Audit Trigger (if applicable)
-- Assuming a generic audit function exists as seen in context
-- CREATE TRIGGER trg_audit_substituicoes AFTER INSERT OR UPDATE OR DELETE ON public.substituicoes_professores
-- FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();
