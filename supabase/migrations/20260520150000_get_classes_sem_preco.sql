-- Função RPC para detectar classes ativas sem preços configurados (matrícula/mensalidade)
CREATE OR REPLACE FUNCTION public.get_classes_sem_preco(p_escola_id uuid, p_ano_letivo int)
RETURNS TABLE (
  curso_nome text,
  classe_nome text,
  missing_type text -- 'sem_configuracao', 'valores_zerados', 'mensalidade_zero', 'matricula_zero'
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cur.nome::text AS curso_nome,
    cls.nome::text AS classe_nome,
    CASE
      WHEN ft.id IS NULL THEN 'sem_configuracao'
      WHEN ft.valor_matricula <= 0 AND ft.valor_mensalidade <= 0 THEN 'valores_zerados'
      WHEN ft.valor_mensalidade <= 0 THEN 'mensalidade_zero'
      ELSE 'matricula_zero'
    END AS missing_type
  FROM public.classes cls
  JOIN public.cursos cur ON cls.curso_id = cur.id
  LEFT JOIN public.financeiro_tabelas ft ON (
    ft.escola_id = p_escola_id
    AND ft.ano_letivo = p_ano_letivo
    AND ft.curso_id = cur.id
    AND ft.classe_id = cls.id
  )
  WHERE
    cur.escola_id = p_escola_id
    AND cur.ativo = true
    AND (
      ft.id IS NULL
      OR ft.valor_matricula <= 0
      OR ft.valor_mensalidade <= 0
    )
  ORDER BY cur.nome, cls.ordem;
END;
$$;

