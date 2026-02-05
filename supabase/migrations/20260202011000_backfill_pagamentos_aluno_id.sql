UPDATE public.pagamentos AS p
SET aluno_id = m.aluno_id
FROM public.mensalidades AS m
WHERE p.aluno_id IS NULL
  AND p.mensalidade_id IS NOT NULL
  AND p.mensalidade_id = m.id;
