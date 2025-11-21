CREATE OR REPLACE VIEW public.vw_radar_inadimplencia AS
SELECT 
    a.id as aluno_id,
    COALESCE(SUM(m.valor - COALESCE(p.valor_pago, 0)), 0) as valor_em_atraso
FROM alunos a
LEFT JOIN mensalidades m ON m.aluno_id = a.id AND m.status = 'em_atraso'
LEFT JOIN pagamentos p ON p.mensalidade_id = m.id AND p.status = 'confirmado'
WHERE COALESCE(SUM(m.valor - COALESCE(p.valor_pago, 0)), 0) > 0
GROUP BY a.id;
