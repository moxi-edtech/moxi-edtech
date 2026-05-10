-- Migration: 20270509000004_create_calendario_templates.sql
-- Description: Create templates system for official academic calendars

-- 1. Table for Template Headers
CREATE TABLE IF NOT EXISTS public.calendario_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL, -- Ex: "Calendário Nacional Angola 2025/2026"
    ano_base INT NOT NULL,       -- O ano de início (ex: 2025)
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    descricao TEXT,
    is_oficial BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table for Template Details (Periods and Events)
CREATE TABLE IF NOT EXISTS public.calendario_template_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.calendario_templates(id) ON DELETE CASCADE,
    tipo tipo_evento_calendario NOT NULL, -- Reutiliza o enum criado antes
    nome VARCHAR(255) NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    peso SMALLINT, -- Apenas para trimestres
    numero SMALLINT, -- 1, 2 ou 3 para trimestres
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Grant access
GRANT SELECT ON public.calendario_templates TO authenticated;
GRANT SELECT ON public.calendario_template_items TO authenticated;

-- 4. Seed with the 2025/2026 Angola Decree data
DO $$
DECLARE
    v_template_id UUID;
BEGIN
    INSERT INTO public.calendario_templates (nome, ano_base, data_inicio, data_fim, descricao)
    VALUES ('Calendário Nacional Angola 2025/2026 (MED)', 2025, '2025-09-01', '2026-07-31', 'Conforme Decreto Executivo n.º 686/25')
    RETURNING id INTO v_template_id;

    -- Trimestres
    INSERT INTO public.calendario_template_items (template_id, tipo, nome, data_inicio, data_fim, numero, peso) VALUES
    (v_template_id, 'PROVA_TRIMESTRAL', 'I Trimestre', '2025-09-02', '2025-12-31', 1, 30),
    (v_template_id, 'PROVA_TRIMESTRAL', 'II Trimestre', '2026-01-05', '2026-04-10', 2, 30),
    (v_template_id, 'PROVA_TRIMESTRAL', 'III Trimestre', '2026-04-13', '2026-07-31', 3, 40);

    -- Feriados
    INSERT INTO public.calendario_template_items (template_id, tipo, nome, data_inicio, data_fim) VALUES
    (v_template_id, 'FERIADO', 'Dia do Herói Nacional', '2025-09-17', '2025-09-17'),
    (v_template_id, 'FERIADO', 'Dia dos Finados', '2025-11-02', '2025-11-02'),
    (v_template_id, 'FERIADO', 'Dia da Independência Nacional', '2025-11-11', '2025-11-11'),
    (v_template_id, 'FERIADO', 'Natal', '2025-12-25', '2025-12-25'),
    (v_template_id, 'FERIADO', 'Ano Novo', '2026-01-01', '2026-01-01'),
    (v_template_id, 'FERIADO', 'Início da Luta Armada', '2026-02-04', '2026-02-04'),
    (v_template_id, 'FERIADO', 'Dia da Mulher', '2026-03-08', '2026-03-08'),
    (v_template_id, 'FERIADO', 'Dia da Libertação da África Austral', '2026-03-23', '2026-03-23'),
    (v_template_id, 'FERIADO', 'Dia da Paz', '2026-04-04', '2026-04-04'),
    (v_template_id, 'FERIADO', 'Dia do Trabalhador', '2026-05-01', '2026-05-01');

    -- Pausas
    INSERT INTO public.calendario_template_items (template_id, tipo, nome, data_inicio, data_fim) VALUES
    (v_template_id, 'PAUSA_PEDAGOGICA', 'Pausa Natal/Ano Novo', '2025-12-22', '2026-01-02'),
    (v_template_id, 'PAUSA_PEDAGOGICA', 'Carnaval', '2026-02-16', '2026-02-17'),
    (v_template_id, 'PAUSA_PEDAGOGICA', 'Pausa Páscoa/Fim II Trim', '2026-03-30', '2026-04-10');
END $$;
