-- DATA POPULATION FOR ESCOLA KLASSE (8th GRADE - ACADEMIC PORTAL)
-- Escola ID: f406f5a7-a077-431c-b118-297224925726
-- Turma: ESG-8-M-A (8ª Classe)

-- 1. NOTICES (Posts específicos para a 8ª Classe)
INSERT INTO public.notices (escola_id, titulo, conteudo, publico_alvo)
VALUES 
('f406f5a7-a077-431c-b118-297224925726', 'Projecto Interdisciplinar 8ª Classe', 'Atenção alunos da 8ª classe, o projecto do trimestre envolverá Biologia e Química. O tema será "Sustentabilidade e Ambiente". Vejam os detalhes com os vossos professores.', 'alunos'),
('f406f5a7-a077-431c-b118-297224925726', 'Visita de Estudo à Estação de Tratamento', 'No dia 22 de Julho, a 8ª classe fará uma visita guiada para a disciplina de Geografia. Tragaim autorização assinada.', 'alunos');

-- 2. SYLLABI (Materiais de Estudo para o 1º Ciclo)
INSERT INTO public.syllabi (escola_id, curso_oferta_id, nome, arquivo_url)
SELECT 'f406f5a7-a077-431c-b118-297224925726'::uuid, id, 'Resumo de Fórmulas Matemáticas - 8ª Classe', 'https://www.africau.edu/images/default/sample.pdf'
FROM public.cursos WHERE nome = 'Iº Ciclo do Secundário' AND escola_id = 'f406f5a7-a077-431c-b118-297224925726'
UNION ALL
SELECT 'f406f5a7-a077-431c-b118-297224925726'::uuid, id, 'Atlas de Biologia: Células e Tecidos', 'https://www.africau.edu/images/default/sample.pdf'
FROM public.cursos WHERE nome = 'Iº Ciclo do Secundário' AND escola_id = 'f406f5a7-a077-431c-b118-297224925726';

-- 3. AULAS COM VÍDEOS (Matemática, Biologia, Física da 8ª Classe)
-- Matemática (901bb473-d472-4de8-9e8e-5e3072b4cecb)
INSERT INTO public.aulas (escola_id, turma_disciplina_id, data, conteudo, numero_aula)
VALUES 
('f406f5a7-a077-431c-b118-297224925726', '901bb473-d472-4de8-9e8e-5e3072b4cecb', CURRENT_DATE - INTERVAL '1 day', '🎥 **Video Aula: Equações do 1º Grau** 
Introdução à resolução de equações e problemas matemáticos. 
Link: https://www.youtube.com/watch?v=dQw4w9WgXcQ', 15);

-- Biologia (07e29e05-baf6-41f0-94b4-a75d91dba520)
INSERT INTO public.aulas (escola_id, turma_disciplina_id, data, conteudo, numero_aula)
VALUES 
('f406f5a7-a077-431c-b118-297224925726', '07e29e05-baf6-41f0-94b4-a75d91dba520', CURRENT_DATE, '🎥 **Video Aula: A Célula Animal** 
Viagem pelo interior da célula e suas organelas. 
Link: https://www.youtube.com/watch?v=dQw4w9WgXcQ', 8);

-- Física (1df487cf-757b-4076-bfa7-c31688d3b98f)
INSERT INTO public.aulas (escola_id, turma_disciplina_id, data, conteudo, numero_aula)
VALUES 
('f406f5a7-a077-431c-b118-297224925726', '1df487cf-757b-4076-bfa7-c31688d3b98f', CURRENT_DATE + INTERVAL '1 day', '🎥 **Video Aula: Movimento Rectilíneo Uniforme** 
Experiência prática sobre velocidade e tempo. 
Link: https://www.youtube.com/watch?v=dQw4w9WgXcQ', 12);
