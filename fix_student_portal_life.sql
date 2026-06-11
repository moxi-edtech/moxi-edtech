-- FIXED DATA FOR Caroline Caliye (56a1f356-ff7f-43e7-a773-974aaa935df9)
-- Matricula: 7f5bd4eb-2258-4e56-9dfc-f38409db91e2
-- Turma: c30e19d6-b86a-4062-a05e-cba2630b26b7 (ESG-8-M-A)

-- 1. ADD ATTENDANCE (FREQUENCIA_STATUS_PERIODO)
INSERT INTO public.frequencia_status_periodo (escola_id, matricula_id, turma_id, periodo_letivo_id, faltas, aulas_previstas, frequencia_min_percent)
VALUES 
('f406f5a7-a077-431c-b118-297224925726', '7f5bd4eb-2258-4e56-9dfc-f38409db91e2', 'c30e19d6-b86a-4062-a05e-cba2630b26b7', 'f3abbeb8-2cea-4adf-b17b-a81897019e8f', 4, 120, 75)
ON CONFLICT (escola_id, matricula_id, periodo_letivo_id) DO UPDATE 
SET faltas = 4, aulas_previstas = 120;

-- 2. ADD FINANCIALS (MENSALIDADES)
-- Update existing ones if they conflict
INSERT INTO public.mensalidades (escola_id, aluno_id, matricula_id, valor, data_vencimento, status, mes_referencia, ano_referencia, turma_id)
VALUES 
('f406f5a7-a077-431c-b118-297224925726', '56a1f356-ff7f-43e7-a773-974aaa935df9', '7f5bd4eb-2258-4e56-9dfc-f38409db91e2', 15000, '2026-03-05', 'pendente', 3, 2026, 'c30e19d6-b86a-4062-a05e-cba2630b26b7'),
('f406f5a7-a077-431c-b118-297224925726', '56a1f356-ff7f-43e7-a773-974aaa935df9', '7f5bd4eb-2258-4e56-9dfc-f38409db91e2', 15000, '2026-04-05', 'pendente', 4, 2026, 'c30e19d6-b86a-4062-a05e-cba2630b26b7')
ON CONFLICT (escola_id, matricula_id, ano_referencia, mes_referencia) DO UPDATE 
SET status = 'pendente';

-- 3. GRANT PERMISSION FOR DETAILED GRADES
INSERT INTO public.servico_pedidos (escola_id, aluno_id, servico_escola_id, servico_codigo, status)
VALUES ('f406f5a7-a077-431c-b118-297224925726', '56a1f356-ff7f-43e7-a773-974aaa935df9', '0546d2e0-ecd6-4438-a5ed-cea386cb2391', 'DOC_DECLARACAO_NOTAS', 'granted')
ON CONFLICT DO NOTHING;
