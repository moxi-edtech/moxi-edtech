-- DATA POPULATION FOR ESCOLA KLASSE (ACADEMIC PORTAL) - FIXED
-- Escola ID: f406f5a7-a077-431c-b118-297224925726

-- 1. NOTICES (Mural do Aluno / Posts)
-- (Already inserted 4 in previous attempt, let's add more or just assume they are there)
INSERT INTO public.notices (escola_id, titulo, conteudo, publico_alvo)
VALUES 
('f406f5a7-a077-431c-b118-297224925726', 'Lançamento da Semana Cultural KLASSE', 'Preparamos uma série de eventos para a próxima semana, incluindo teatro e música. Fiquem atentos!', 'todos'),
('f406f5a7-a077-431c-b118-297224925726', 'Manual do Aluno 2025/2026', 'O manual atualizado com todas as normas da instituição já pode ser baixado.', 'alunos')
ON CONFLICT DO NOTHING;

-- 2. SYLLABI (Materiais de Estudo / PDFs)
-- Using explicit casting for UUID
INSERT INTO public.syllabi (escola_id, curso_oferta_id, nome, arquivo_url)
SELECT 'f406f5a7-a077-431c-b118-297224925726'::uuid, id, 'Manual de Procedimentos Hospitalares - v1', 'https://www.africau.edu/images/default/sample.pdf'
FROM public.cursos WHERE nome = 'Técnico de Enfermagem' AND escola_id = 'f406f5a7-a077-431c-b118-297224925726'
UNION ALL
SELECT 'f406f5a7-a077-431c-b118-297224925726'::uuid, id, 'Guia de Biossegurança em Laboratório', 'https://www.africau.edu/images/default/sample.pdf'
FROM public.cursos WHERE nome = 'Técnico de Análises Clínicas' AND escola_id = 'f406f5a7-a077-431c-b118-297224925726'
UNION ALL
SELECT 'f406f5a7-a077-431c-b118-297224925726'::uuid, id, 'Anatomia e Fisiologia Humana - Apontamentos', 'https://www.africau.edu/images/default/sample.pdf'
FROM public.cursos WHERE nome = 'Técnico de Enfermagem' AND escola_id = 'f406f5a7-a077-431c-b118-297224925726';

-- 3. AULAS COM VÍDEOS
DO $$
DECLARE
    v_td_id UUID;
BEGIN
    -- Nursing class discipline
    SELECT td.id INTO v_td_id
    FROM public.turma_disciplinas td
    JOIN public.turmas t ON td.turma_id = t.id
    JOIN public.cursos c ON t.curso_id = c.id
    WHERE c.nome = 'Técnico de Enfermagem' 
    AND td.escola_id = 'f406f5a7-a077-431c-b118-297224925726'
    LIMIT 1;

    IF v_td_id IS NOT NULL THEN
        INSERT INTO public.aulas (escola_id, turma_disciplina_id, data, conteudo, numero_aula)
        VALUES 
        ('f406f5a7-a077-431c-b118-297224925726', v_td_id, CURRENT_DATE - INTERVAL '2 days', '🎥 **Video Aula: Fundamentos de Enfermagem** 
        Assista ao vídeo da aula prática sobre sinais vitais. 
        Link: https://www.youtube.com/watch?v=dQw4w9WgXcQ', 10),
        
        ('f406f5a7-a077-431c-b118-297224925726', v_td_id, CURRENT_DATE - INTERVAL '1 day', '📖 **Material Teórico: Ética Profissional** 
        Discussão sobre o código de ética e conduta no ambiente hospitalar.', 11),
        
        ('f406f5a7-a077-431c-b118-297224925726', v_td_id, CURRENT_DATE, '🎥 **Video Aula: Administração de Medicamentos** 
        Tutorial passo a passo sobre vias de administração. 
        Link: https://www.youtube.com/watch?v=dQw4w9WgXcQ', 12);
    END IF;
END $$;

-- 4. AVALIAÇÕES
DO $$
DECLARE
    v_td_id UUID;
    v_periodo_id UUID := 'f3abbeb8-2cea-4adf-b17b-a81897019e8f';
    v_ano INT := 2025;
    v_trimestre INT := 1;
BEGIN
    SELECT td.id INTO v_td_id
    FROM public.turma_disciplinas td
    JOIN public.turmas t ON td.turma_id = t.id
    JOIN public.cursos c ON t.curso_id = c.id
    WHERE c.nome = 'Técnico de Enfermagem' 
    AND td.escola_id = 'f406f5a7-a077-431c-b118-297224925726'
    LIMIT 1;

    IF v_td_id IS NOT NULL THEN
        INSERT INTO public.avaliacoes (escola_id, turma_disciplina_id, periodo_letivo_id, nome, ano_letivo, trimestre, peso, tipo)
        VALUES 
        ('f406f5a7-a077-431c-b118-297224925726', v_td_id, v_periodo_id, 'Prova Trimestral 1', v_ano, v_trimestre, 10, 'MAC'),
        ('f406f5a7-a077-431c-b118-297224925726', v_td_id, v_periodo_id, 'Trabalho de Investigação', v_ano, v_trimestre, 5, 'MAC')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
