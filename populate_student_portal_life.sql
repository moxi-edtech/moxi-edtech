-- FIX FOR DASHBOARD AVISOS
CREATE OR REPLACE VIEW public.avisos AS
SELECT 
    id,
    escola_id,
    titulo,
    conteudo as resumo,
    'Secretaria' as origem,
    criado_em as created_at
FROM public.notices;

-- DATA FOR Caroline Caliye (56a1f356-ff7f-43e7-a773-974aaa935df9)
-- Matricula: 7f5bd4eb-2258-4e56-9dfc-f38409db91e2
-- Turma: ESG-8-M-A (8ª Classe)

-- 1. ADD GRADES (NOTAS)
-- Let's find some evaluations for her class
INSERT INTO public.notas (escola_id, avaliacao_id, matricula_id, valor)
SELECT 'f406f5a7-a077-431c-b118-297224925726', id, '7f5bd4eb-2258-4e56-9dfc-f38409db91e2', 15.5
FROM public.avaliacoes 
WHERE turma_disciplina_id IN (
    SELECT id FROM public.turma_disciplinas WHERE turma_id = 'c30e19d6-b86a-4062-a05e-cba2630b26b7'
)
LIMIT 5
ON CONFLICT DO NOTHING;

-- 2. ADD ATTENDANCE (FREQUENCIA_STATUS_PERIODO)
INSERT INTO public.frequencia_status_periodo (escola_id, matricula_id, periodo_letivo_id, faltas, aulas_previstas, frequencia_min_percent)
VALUES 
('f406f5a7-a077-431c-b118-297224925726', '7f5bd4eb-2258-4e56-9dfc-f38409db91e2', 'f3abbeb8-2cea-4adf-b17b-a81897019e8f', 4, 120, 75)
ON CONFLICT DO NOTHING;

-- 3. ADD FINANCIALS (MENSALIDADES)
INSERT INTO public.mensalidades (escola_id, aluno_id, matricula_id, valor, data_vencimento, status, mes_referencia, ano_referencia)
VALUES 
('f406f5a7-a077-431c-b118-297224925726', '56a1f356-ff7f-43e7-a773-974aaa935df9', '7f5bd4eb-2258-4e56-9dfc-f38409db91e2', 15000, '2026-01-05', 'pago', 1, 2026),
('f406f5a7-a077-431c-b118-297224925726', '56a1f356-ff7f-43e7-a773-974aaa935df9', '7f5bd4eb-2258-4e56-9dfc-f38409db91e2', 15000, '2026-02-05', 'pago', 2, 2026),
('f406f5a7-a077-431c-b118-297224925726', '56a1f356-ff7f-43e7-a773-974aaa935df9', '7f5bd4eb-2258-4e56-9dfc-f38409db91e2', 15000, '2026-03-05', 'pendente', 3, 2026),
('f406f5a7-a077-431c-b118-297224925726', '56a1f356-ff7f-43e7-a773-974aaa935df9', '7f5bd4eb-2258-4e56-9dfc-f38409db91e2', 15000, '2026-04-05', 'pendente', 4, 2026);

-- 4. GRANT PERMISSION FOR DETAILED GRADES (Mocking a paid service)
INSERT INTO public.servico_pedidos (escola_id, aluno_id, servico_codigo, status)
VALUES ('f406f5a7-a077-431c-b118-297224925726', '56a1f356-ff7f-43e7-a773-974aaa935df9', 'DOC_DECLARACAO_NOTAS', 'granted')
ON CONFLICT DO NOTHING;

-- 5. UPDATE PROFILE PHOTOS
UPDATE public.profiles 
SET avatar_url = 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&auto=format&fit=crop'
WHERE user_id = '6da3527f-601a-4d24-b449-778ce2bfa68b'; -- Caroline Caliye Profile ID

-- ALSO FOR Mulemba Cunha (2d0ae801-ee1b-4e6d-9fb0-a96c03cbb9db)
UPDATE public.profiles 
SET avatar_url = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop'
WHERE user_id = '2d0ae801-ee1b-4e6d-9fb0-a96c03cbb9db';
