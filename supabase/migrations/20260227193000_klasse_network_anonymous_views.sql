-- Migration: 20260227193000_klasse_network_anonymous_views.sql
-- Descrição: Cria as views agregadas e anónimas para o futuro painel do MED (Fase 1 do KLASSE Network).
-- Nota: Garantia estrita de que nenhum dado pessoal ou ID rastreável é exposto nestas views.

BEGIN;

-- 1. View: Matrículas (Crescimento e Distribuição Nacional)
CREATE OR REPLACE VIEW public.vw_klasse_network_matriculas AS
SELECT
  COALESCE(e.endereco, 'Desconhecida') AS provincia, -- Usando endereco como proxy temporal de província
  COALESCE(c.nome, 'Não Atribuído') AS curso,
  m.ano_letivo,
  COUNT(DISTINCT m.aluno_id) AS total_matriculas,
  COUNT(DISTINCT m.escola_id) AS total_escolas
FROM public.matriculas m
JOIN public.escolas e ON m.escola_id = e.id
LEFT JOIN public.turmas t ON m.turma_id = t.id
LEFT JOIN public.cursos c ON t.curso_id = c.id
WHERE m.status IN ('ativa', 'ativo', 'concluido')
  AND m.ativo = true
GROUP BY 
  COALESCE(e.endereco, 'Desconhecida'), 
  COALESCE(c.nome, 'Não Atribuído'), 
  m.ano_letivo;

-- 2. View: Resultados Académicos (Aprovação por Província e Curso)
CREATE OR REPLACE VIEW public.vw_klasse_network_aprovacao AS
SELECT
  COALESCE(e.endereco, 'Desconhecida') AS provincia,
  COALESCE(c.nome, 'Não Atribuído') AS curso,
  COALESCE(cl.nome, 'Não Atribuído') AS classe,
  h.ano_letivo,
  -- Calcula a taxa de aprovação (Aprovados / Total com resultado final)
  ROUND(
    (SUM(CASE WHEN h.resultado_final = 'Aprovado' THEN 1 ELSE 0 END)::numeric / 
    NULLIF(COUNT(h.id), 0)) * 100, 
  2) AS aprovacao_media_percentagem,
  COUNT(DISTINCT h.turma_id) AS total_turmas,
  COUNT(DISTINCT h.aluno_id) AS total_alunos_avaliados
FROM public.historico_anos h
JOIN public.escolas e ON h.escola_id = e.id
JOIN public.turmas t ON h.turma_id = t.id
LEFT JOIN public.cursos c ON t.curso_id = c.id
LEFT JOIN public.classes cl ON t.classe_id = cl.id
WHERE h.resultado_final IN ('Aprovado', 'Reprovado') -- Foca apenas em anos letivos fechados
GROUP BY 
  COALESCE(e.endereco, 'Desconhecida'),
  COALESCE(c.nome, 'Não Atribuído'),
  COALESCE(cl.nome, 'Não Atribuído'),
  h.ano_letivo;

-- Garantir que as views só podem ser lidas pelo service_role (painel interno/BI)
-- Protecção extra para evitar que um tenant aceda aos dados agregados acidentalmente via API
REVOKE ALL ON public.vw_klasse_network_matriculas FROM authenticated, anon;
GRANT SELECT ON public.vw_klasse_network_matriculas TO service_role;

REVOKE ALL ON public.vw_klasse_network_aprovacao FROM authenticated, anon;
GRANT SELECT ON public.vw_klasse_network_aprovacao TO service_role;

COMMIT;
