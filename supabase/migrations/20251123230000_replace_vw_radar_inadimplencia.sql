-- Alinhado para consumir mensalidades (fluxo da secretaria)
-- Mantém as colunas esperadas pelo frontend/API do Radar

CREATE OR REPLACE VIEW public.vw_radar_inadimplencia
WITH (security_invoker = true)
AS
SELECT
  m.id                                            AS mensalidade_id,
  m.aluno_id                                      AS aluno_id,
  a.nome                                          AS nome_aluno,
  a.responsavel                                   AS responsavel,
  a.telefone_responsavel                          AS telefone,
  t.nome                                          AS nome_turma,
  -- bate com o tipo atual da view (numeric(10,2))
  COALESCE(m.valor, 0)::numeric(10,2)             AS valor_previsto,
  -- mantém numeric "puro", igual está hoje
  0::numeric                                      AS valor_pago_total,
  -- mantém numeric "puro" para não forçar mudança de tipo
  COALESCE(m.valor, 0)::numeric                   AS valor_em_atraso,
  m.data_vencimento                               AS data_vencimento,
  GREATEST(0, (CURRENT_DATE - m.data_vencimento))::int AS dias_em_atraso,
  CASE
    WHEN (CURRENT_DATE - m.data_vencimento) >= 30 THEN 'critico'
    WHEN (CURRENT_DATE - m.data_vencimento) >= 10 THEN 'atencao'
    ELSE 'recente'
  END                                             AS status_risco,
  m.status                                        AS status_mensalidade
FROM public.mensalidades m
JOIN public.alunos a
  ON a.id = m.aluno_id
LEFT JOIN public.matriculas mat
  ON mat.aluno_id = m.aluno_id
 AND (mat.status IN ('ativo','ativa') OR mat.ativo = true)
LEFT JOIN public.turmas t
  ON t.id = mat.turma_id
WHERE mat.escola_id = public.current_tenant_escola_id()
  AND (m.status IS NULL OR m.status <> 'pago')
  AND m.data_vencimento < CURRENT_DATE;

GRANT ALL ON TABLE public.vw_radar_inadimplencia TO anon;
GRANT ALL ON TABLE public.vw_radar_inadimplencia TO authenticated;
GRANT ALL ON TABLE public.vw_radar_inadimplencia TO service_role;
