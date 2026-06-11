-- DATA POPULATION FOR ESCOLA KLASSE (ACADEMIC PORTAL) - SPLIT SCRIPT
-- Escola ID: f406f5a7-a077-431c-b118-297224925726

-- 1. NOTICES (Mural do Aluno / Posts)
INSERT INTO public.notices (escola_id, titulo, conteudo, publico_alvo)
VALUES 
('f406f5a7-a077-431c-b118-297224925726', 'Comunicado: Reunião de Pais e Encarregados', 'Convidamos todos os encarregados para a reunião trimestral que terá lugar no auditório principal, às 10h de Sábado.', 'todos'),
('f406f5a7-a077-431c-b118-297224925726', 'Resultados dos Testes Intermédios', 'Os resultados já estão disponíveis para consulta no portal. Em caso de dúvida, contactem o vosso coordenador de curso.', 'alunos')
ON CONFLICT DO NOTHING;

-- 2. AULAS COM VÍDEOS (Lessons with Video content)
DO $$
DECLARE
    v_td_id UUID;
BEGIN
    -- Get one discipline from a Nursing class
    SELECT td.id INTO v_td_id
    FROM public.turma_disciplinas td
    JOIN public.turmas t ON td.turma_id = t.id
    JOIN public.cursos c ON t.curso_id = c.id
    WHERE c.nome = 'Técnico de Enfermagem' 
    AND td.escola_id = 'f406f5a7-a077-431c-b118-297224925726'
    LIMIT 1;

    IF v_td_id IS NOT NULL THEN
        -- Add lessons with simulated video links in the content
        INSERT INTO public.aulas (escola_id, turma_disciplina_id, data, conteudo, numero_aula)
        VALUES 
        ('f406f5a7-a077-431c-b118-297224925726', v_td_id, CURRENT_DATE - INTERVAL '2 days', '🎥 **Video Aula: Fundamentos de Enfermagem** 
        Assista ao vídeo da aula prática sobre sinais vitais. 
        Link: https://www.youtube.com/watch?v=dQw4w9WgXcQ', 20),
        
        ('f406f5a7-a077-431c-b118-297224925726', v_td_id, CURRENT_DATE - INTERVAL '1 day', '📖 **Material Teórico: Ética Profissional** 
        Discussão sobre o código de ética e conduta no ambiente hospitalar.', 21),
        
        ('f406f5a7-a077-431c-b118-297224925726', v_td_id, CURRENT_DATE, '🎥 **Video Aula: Administração de Medicamentos** 
        Tutorial passo a passo sobre vias de administração. 
        Link: https://www.youtube.com/watch?v=dQw4w9WgXcQ', 22);
    END IF;
END $$;

-- 3. AVALIAÇÕES (Evaluations)
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
