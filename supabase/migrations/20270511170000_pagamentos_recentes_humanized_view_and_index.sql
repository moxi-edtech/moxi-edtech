CREATE INDEX IF NOT EXISTS idx_pagamentos_escola_day_created_at
  ON public.pagamentos(escola_id, day_key, created_at DESC);

CREATE OR REPLACE VIEW public.vw_pagamentos_recentes_humanized AS
SELECT
  p.id,
  p.escola_id,
  p.day_key,
  p.aluno_id,
  COALESCE(NULLIF(a.nome_completo, ''), NULLIF(a.nome, ''), 'Aluno não identificado') AS aluno_nome,
  p.valor_pago,
  p.metodo,
  CASE
    WHEN lower(COALESCE(p.metodo, '')) IN ('cash', 'dinheiro', 'numerario') THEN 'Numerário'
    WHEN lower(COALESCE(p.metodo, '')) = 'tpa' THEN 'TPA'
    WHEN lower(COALESCE(p.metodo, '')) IN ('transfer', 'transferencia') THEN 'Transferência'
    WHEN lower(COALESCE(p.metodo, '')) IN ('mcx', 'multicaixa') THEN 'Multicaixa'
    WHEN lower(COALESCE(p.metodo, '')) IN ('kiwk', 'kwik') THEN 'KIWK'
    ELSE COALESCE(p.metodo, 'Método não informado')
  END AS metodo_label,
  p.status,
  CASE
    WHEN lower(COALESCE(p.status, '')) IN ('settled', 'liquidado') THEN 'Liquidado'
    WHEN lower(COALESCE(p.status, '')) IN ('pago', 'confirmado') THEN 'Pago'
    WHEN lower(COALESCE(p.status, '')) = 'pendente' THEN 'Pendente'
    WHEN lower(COALESCE(p.status, '')) IN ('failed', 'falhado') THEN 'Falhado'
    ELSE COALESCE(p.status, '—')
  END AS status_label,
  p.created_at
FROM public.pagamentos p
LEFT JOIN public.alunos a ON a.id = p.aluno_id;
