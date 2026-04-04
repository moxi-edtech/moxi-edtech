BEGIN;

CREATE OR REPLACE VIEW public.vw_pagamentos_pendentes
WITH (security_invoker = true) AS
SELECT
  p.id AS pagamento_id,
  p.escola_id,
  m.id AS mensalidade_id,
  m.aluno_id,
  COALESCE(a.nome_completo, a.nome) AS aluno_nome,
  COALESCE(t.turma_codigo, t.turma_code, t.nome) AS turma_codigo,
  COALESCE(m.valor_previsto, m.valor) AS valor_esperado,
  p.valor_pago AS valor_enviado,
  p.evidence_url AS comprovante_url,
  p.reference,
  p.metodo,
  p.created_at
FROM public.pagamentos p
JOIN public.mensalidades m ON m.id = p.mensalidade_id
JOIN public.alunos a ON a.id = m.aluno_id
LEFT JOIN public.turmas t ON t.id = m.turma_id
WHERE p.status = 'pending';

GRANT SELECT ON public.vw_pagamentos_pendentes TO authenticated;
GRANT SELECT ON public.vw_pagamentos_pendentes TO service_role;

COMMIT;
