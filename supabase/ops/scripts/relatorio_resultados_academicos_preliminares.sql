-- KLASSE | Exportação de resultados académicos calculados (NÃO OFICIAIS)
-- Execução: sessão autenticada com papel secretaria/admin da escola.
-- Não executar no editor SQL do dashboard sem contexto de autenticação.
-- O ano '2025' corresponde ao ano 2025/2026; alterar apenas se necessário.
-- Nenhuma matrícula, nota, decisão, resultado ou histórico é alterado.
-- O resultado oficial só existe após decisão documentada e fecho legal.
WITH matriculas_escola AS MATERIALIZED (
  SELECT m.id, m.aluno_id, m.escola_id, m.ano_letivo,
         m.turma_id, m.status, m.ativo, m.origem_transicao_matricula_id
  FROM public.matriculas m
  WHERE m.escola_id = public.current_tenant_escola_id()
    AND m.ano_letivo = 2025
),
evidencia AS MATERIALIZED (
  SELECT m.id AS matricula_id,
         public.gradeengine_calcular_situacao(m.id) AS calculo
  FROM matriculas_escola m
),
notas_contadas AS (
  SELECT n.matricula_id, count(*)::integer AS quantidade_notas
  FROM public.notas n JOIN matriculas_escola m ON m.id=n.matricula_id
  WHERE n.escola_id=m.escola_id
  GROUP BY n.matricula_id
),
destinos AS (
  SELECT origem.id AS matricula_id,
    bool_or(d.ativo IS TRUE) AS destino_ativo,
    bool_or(d.origem_transicao_matricula_id = origem.id) AS destino_vinculado
  FROM matriculas_escola origem
  LEFT JOIN public.matriculas d ON d.escola_id=origem.escola_id
    AND d.aluno_id=origem.aluno_id AND d.ano_letivo>origem.ano_letivo
  GROUP BY origem.id
)
SELECT
  m.escola_id,
  m.ano_letivo,
  m.id AS matricula_id,
  m.aluno_id,
  coalesce(nullif(a.nome_completo, ''), a.nome) AS aluno_nome,
  a.numero_processo,
  c.nome AS classe,
  t.nome AS turma,
  m.status AS estado_matricula,
  coalesce(n.quantidade_notas,0) AS quantidade_notas,
  e.calculo->>'situacao_final' AS resultado_calculado,
  e.calculo->'motivos' AS motivos_calculo,
  h.resultado_final AS decisao_registada,
  h.snapshot_status AS estado_historico,
  ssot.resultado_oficial AS resultado_oficial,
  coalesce(d.destino_ativo,false) AS tem_destino_ativo,
  coalesce(d.destino_vinculado,false) AS tem_destino_vinculado,
  coorte.codigo AS coorte_assistida,
  case
    when ssot.resultado_oficial is not null
      then 'Oficial — consultar histórico'
    when h.resultado_final is not null
      then 'Confirmar evidência documental, ratificar e fechar histórico pelo fluxo legal'
    when e.calculo->>'situacao_final'='incompleto'
      then 'Conferir matriz, pautas e decisão escolar — aprovação não presumida'
    else 'Validar cálculo e finalizar exclusivamente pelo fluxo académico autorizado'
  end AS proximo_passo
FROM matriculas_escola m
JOIN public.alunos a ON a.id=m.aluno_id AND a.escola_id=m.escola_id
LEFT JOIN public.turmas t ON t.id=m.turma_id AND t.escola_id=m.escola_id
LEFT JOIN public.classes c ON c.id=t.classe_id
LEFT JOIN evidencia e ON e.matricula_id=m.id
LEFT JOIN notas_contadas n ON n.matricula_id=m.id
LEFT JOIN destinos d ON d.matricula_id=m.id
LEFT JOIN public.historico_anos h ON h.matricula_id=m.id AND h.escola_id=m.escola_id
LEFT JOIN public.v_student_lifecycle_ssot_v1 ssot ON ssot.matricula_id=m.id
LEFT JOIN public.academic_transition_cohort_members membro
  ON membro.escola_id=m.escola_id AND membro.matricula_origem_id=m.id
LEFT JOIN public.academic_transition_cohorts coorte
  ON coorte.id=membro.cohort_id AND coorte.escola_id=m.escola_id
ORDER BY c.numero NULLS LAST,c.nome,t.nome,aluno_nome,m.id;
