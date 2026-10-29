-- Curtume | academic year transition audit (READ ONLY).
-- Safe on live data: returns counts for follow-up; no grades, official decisions,
-- enrolments or fiscal tables modified. Run with an authorized school session.
WITH escola AS (
  SELECT id FROM public.escolas
  WHERE slug='complexo-escolar-privado-advetista-de-curtume'
),
origem AS (
  SELECT m.id matricula_id,m.aluno_id,m.ano_letivo,m.status,
    CASE WHEN c.nome='Pré-Escolar' THEN 0 ELSE c.numero END grade,
    c.nome classe
  FROM public.matriculas m
  JOIN public.turmas t ON t.id=m.turma_id AND t.escola_id=m.escola_id
  JOIN public.classes c ON c.id=t.classe_id AND c.escola_id=m.escola_id
  JOIN escola e ON e.id=m.escola_id
  WHERE m.ano_letivo=2025
),
destino AS (
  SELECT m.id matricula_id,m.aluno_id,m.origem_transicao_matricula_id,m.status,
    CASE WHEN c.nome='Pré-Escolar' THEN 0 ELSE c.numero END grade,
    c.nome classe
  FROM public.matriculas m
  JOIN public.turmas t ON t.id=m.turma_id AND t.escola_id=m.escola_id
  JOIN public.classes c ON c.id=t.classe_id AND c.escola_id=m.escola_id
  JOIN escola e ON e.id=m.escola_id
  WHERE m.ano_letivo=2026
),
ligacoes AS (
  SELECT p.matricula_id origem_id,d.matricula_id destino_id,
         p.aluno_id,p.grade origem_classe,d.grade destino_classe,
         d.origem_transicao_matricula_id,
         h.resultado_final decisao_documentada
  FROM origem p LEFT JOIN destino d ON d.aluno_id=p.aluno_id
  LEFT JOIN public.historico_anos h
    ON h.matricula_id=p.matricula_id AND h.ano_letivo=2025
),
classificados AS (
 SELECT *,
  CASE
    WHEN destino_id IS NULL THEN 'SEM_MATRICULA_2026'
    WHEN origem_transicao_matricula_id IS NULL THEN 'DESTINO_SEM_VINCULO'
    WHEN origem_transicao_matricula_id IS DISTINCT FROM origem_id THEN 'VINCULO_DIVERGENTE'
    WHEN origem_classe IS NULL OR destino_classe IS NULL THEN 'CLASSE_NAO_IDENTIFICADA'
    WHEN destino_classe < origem_classe THEN 'REGRESSAO_DE_CLASSE'
    WHEN destino_classe > origem_classe+1 THEN 'SALTO_DE_CLASSE'
    WHEN destino_classe=origem_classe AND decisao_documentada IS NULL THEN 'REPETICAO_A_CONFIRMAR'
    WHEN destino_classe=origem_classe AND decisao_documentada='aprovado' THEN 'RESULTADO_CONTRADITORIO'
    WHEN destino_classe=origem_classe+1 AND decisao_documentada='reprovado' THEN 'RESULTADO_CONTRADITORIO'
    ELSE 'CONFERIR_DECISAO_OFICIAL'
  END situacao
 FROM ligacoes
)
SELECT situacao,count(*)::integer quantidade
FROM classificados
GROUP BY situacao ORDER BY situacao;
