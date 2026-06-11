-- NOTICES (POSTS)
INSERT INTO public.notices (escola_id, titulo, conteudo, publico_alvo)
VALUES 
('f406f5a7-a077-431c-b118-297224925726', 'Boas-vindas ao Novo Portal do Aluno!', 'Estamos felizes em anunciar o lançamento do nosso novo portal. Aqui você encontrará todos os seus materiais, notas e vídeos de forma organizada.', 'todos'),
('f406f5a7-a077-431c-b118-297224925726', 'Calendário de Exames do 1º Trimestre', 'Os exames terão início no dia 15 de Julho. Verifique o cronograma completo na seção de documentos.', 'alunos'),
('f406f5a7-a077-431c-b118-297224925726', 'Workshop: Introdução à Robótica', 'Inscrições abertas para o workshop de robótica que acontecerá no próximo sábado. Vagas limitadas!', 'alunos'),
('f406f5a7-a077-431c-b118-297224925726', 'Nova Coleção de Livros Técnicos', 'A biblioteca recebeu 50 novos títulos na área de saúde e construção civil. Venha conferir!', 'todos'),
('f406f5a7-a077-431c-b118-297224925726', 'Dicas de Estudo para Alta Performance', 'Confira nosso novo post no blog sobre como organizar seu tempo e melhorar seus resultados acadêmicos.', 'alunos');

-- FORMACAO COURSES (FOR VIDEOS)
INSERT INTO public.formacao_cursos (id, escola_id, nome, descricao, thumbnail_url, video_url, status)
VALUES 
('a1111111-1111-4111-a111-111111111111', 'f406f5a7-a077-431c-b118-297224925726', 'Introdução às Competências Digitais', 'Aprenda as ferramentas essenciais para o mercado de trabalho moderno.', 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'publicado'),
('a2222222-2222-4222-a222-222222222222', 'f406f5a7-a077-431c-b118-297224925726', 'Literacia Financeira para Estudantes', 'Como gerir as suas finanças pessoais desde cedo.', 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&auto=format&fit=crop', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'publicado'),
('a3333333-3333-4333-a333-333333333333', 'f406f5a7-a077-431c-b118-297224925726', 'Técnicas de Estudo e Memorização', 'Melhore o seu rendimento académico com métodos comprovados.', 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&auto=format&fit=crop', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'publicado');

-- COHORTS FOR THE COURSES
INSERT INTO public.formacao_cohorts (id, escola_id, curso_id, nome, status, data_inicio)
VALUES 
('b1111111-1111-4111-b111-111111111111', 'f406f5a7-a077-431c-b118-297224925726', 'a1111111-1111-4111-a111-111111111111', 'Turma A - 2026', 'ativo', CURRENT_DATE),
('b2222222-2222-4222-b222-222222222222', 'f406f5a7-a077-431c-b118-297224925726', 'a2222222-2222-4222-a222-222222222222', 'Turma Única', 'ativo', CURRENT_DATE),
('b3333333-3333-4333-b333-333333333333', 'f406f5a7-a077-431c-b118-297224925726', 'a3333333-3333-4333-a333-333333333333', 'Intensivo Julho', 'ativo', CURRENT_DATE);

-- MODULES
INSERT INTO public.formacao_curso_modulos (escola_id, curso_id, ordem, titulo, descricao)
VALUES 
('f406f5a7-a077-431c-b118-297224925726', 'a1111111-1111-4111-a111-111111111111', 1, 'Módulo 1: Office 365', 'Fundamentos de Word, Excel e PowerPoint.'),
('f406f5a7-a077-431c-b118-297224925726', 'a1111111-1111-4111-a111-111111111111', 2, 'Módulo 2: Colaboração Online', 'Uso do Teams e ferramentas Google.'),
('f406f5a7-a077-431c-b118-297224925726', 'a2222222-2222-4222-a222-222222222222', 1, 'Módulo 1: Orçamento Mensal', 'Como criar e seguir um plano financeiro.'),
('f406f5a7-a077-431c-b118-297224925726', 'a3333333-3333-4333-a333-333333333333', 1, 'Módulo 1: Mapas Mentais', 'Visualização criativa de conceitos.');

-- MATERIALS (VIDEOS & PDFS)
INSERT INTO public.formacao_curso_materiais (escola_id, curso_id, titulo, url, tipo)
VALUES 
('f406f5a7-a077-431c-b118-297224925726', 'a1111111-1111-4111-a111-111111111111', 'Aula 1: Introdução ao Excel', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'video'),
('f406f5a7-a077-431c-b118-297224925726', 'a1111111-1111-4111-a111-111111111111', 'Guia Rápido de Atalhos Keyboard', 'https://www.africau.edu/images/default/sample.pdf', 'pdf'),
('f406f5a7-a077-431c-b118-297224925726', 'a2222222-2222-4222-a222-222222222222', 'Vídeo: A Regra dos 50/30/20', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'video'),
('f406f5a7-a077-431c-b118-297224925726', 'a2222222-2222-4222-a222-222222222222', 'Planilha de Gastos Excel', 'https://www.africau.edu/images/default/sample.pdf', 'pdf'),
('f406f5a7-a077-431c-b118-297224925726', 'a3333333-3333-4333-a333-333333333333', 'Workshop de Memorização ao Vivo', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'video');

-- SYLLABI FOR ACADEMIC COURSES
-- Getting some IDs first
INSERT INTO public.syllabi (escola_id, curso_oferta_id, nome, arquivo_url)
SELECT 'f406f5a7-a077-431c-b118-297224925726', id, 'Plano de Estudos - 2026', 'https://www.africau.edu/images/default/sample.pdf'
FROM public.cursos
WHERE escola_id = 'f406f5a7-a077-431c-b118-297224925726'
LIMIT 5;

-- ENROLLMENTS (FORMACAO_INSCRICOES)
-- Enrolling the first 5 students in the 3 courses
INSERT INTO public.formacao_inscricoes (escola_id, cohort_id, formando_user_id, origem, estado, status_pagamento, modalidade)
VALUES 
('f406f5a7-a077-431c-b118-297224925726', 'b1111111-1111-4111-b111-111111111111', '2d0ae801-ee1b-4e6d-9fb0-a96c03cbb9db', 'balcao', 'inscrito', 'pago', 'online_gravado'),
('f406f5a7-a077-431c-b118-297224925726', 'b1111111-1111-4111-b111-111111111111', '36d8b272-c23d-4f04-b84a-e05eb7e40b2a', 'balcao', 'inscrito', 'pago', 'online_gravado'),
('f406f5a7-a077-431c-b118-297224925726', 'b2222222-2222-4222-b222-222222222222', '51db17fc-336a-4d6b-ad69-ff34fb761400', 'balcao', 'inscrito', 'pago', 'online_gravado'),
('f406f5a7-a077-431c-b118-297224925726', 'b2222222-2222-4222-b222-222222222222', '621708c4-6ca6-4f4a-9cf3-d3e76b804618', 'balcao', 'inscrito', 'pago', 'online_gravado'),
('f406f5a7-a077-431c-b118-297224925726', 'b3333333-3333-4333-b333-333333333333', '6da3527f-601a-4d24-b449-778ce2bfa68b', 'balcao', 'inscrito', 'pago', 'online_gravado'),
('f406f5a7-a077-431c-b118-297224925726', 'b3333333-3333-4333-b333-333333333333', '726a459d-83ad-489d-84fc-ea9957b687aa', 'balcao', 'inscrito', 'pago', 'online_gravado');
