UPDATE public.financeiro_lancamentos AS l
SET created_by = m.updated_by
FROM public.mensalidades AS m
WHERE l.created_by IS NULL
  AND l.origem = 'mensalidade'
  AND l.tipo = 'debito'
  AND l.status = 'pago'
  AND m.updated_by IS NOT NULL
  AND l.escola_id = m.escola_id
  AND l.aluno_id = m.aluno_id
  AND l.ano_referencia IS NOT DISTINCT FROM m.ano_referencia
  AND l.mes_referencia IS NOT DISTINCT FROM m.mes_referencia;
