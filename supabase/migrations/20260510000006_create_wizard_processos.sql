-- Migration: 20260510000006_create_wizard_processos.sql
-- Descrição: Tabela para persistir o estado de assistentes guiados (Wizards).
-- Objetivo: Garantir que processos longos (como virada de ano) possam ser retomados após falha ou logout.

BEGIN;

CREATE TABLE IF NOT EXISTS public.wizard_processos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
    tipo text NOT NULL, -- 'virada_ano_letivo'
    status text NOT NULL DEFAULT 'active', -- 'active', 'completed', 'failed', 'cancelled'
    current_step int NOT NULL DEFAULT 0,
    payload jsonb DEFAULT '{}'::jsonb, -- Dados salvos pelo usuário nos passos
    metadata jsonb DEFAULT '{}'::jsonb, -- Logs de erro, progresso de background jobs
    created_by uuid NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.wizard_processos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso Wizard por Escola" ON public.wizard_processos
    FOR ALL
    USING (escola_id IN (SELECT escola_id FROM public.escola_users WHERE user_id = auth.uid()));

-- Função para atualizar updated_at (Usando nome canônico encontrado no banco)
CREATE TRIGGER trg_wizard_processos_updated_at 
    BEFORE UPDATE ON public.wizard_processos 
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMIT;
