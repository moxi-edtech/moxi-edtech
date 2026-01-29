-- Migration: 20260127020700_admin_get_escola_health_metrics_rpc.sql
-- Description: Adds an RPC function to efficiently retrieve health metrics for all active schools.

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_get_escola_health_metrics()
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT jsonb_build_object(
    'id', e.id,
    'nome', e.nome,
    'plano', e.plano_atual,
    'alunos_ativos', (SELECT COUNT(*) FROM public.alunos a WHERE a.escola_id = e.id AND a.status = 'ativo'),
    'professores', (SELECT COUNT(*) FROM public.professores p WHERE p.escola_id = e.id),
    'turmas', (SELECT COUNT(*) FROM public.turmas t WHERE t.escola_id = e.id AND t.status_validacao = 'ativo'),
    'ultimo_acesso', (SELECT created_at FROM public.audit_logs al WHERE al.escola_id = e.id ORDER BY created_at DESC LIMIT 1),
    'latencia_media', FLOOR(RANDOM() * 300) + 100, -- Still simulated for now; requires external monitoring integration
    'sync_status', (SELECT af.sync_status FROM public.aggregates_financeiro af WHERE af.escola_id = e.id AND af.aluno_id IS NULL ORDER BY af.sync_updated_at DESC LIMIT 1),
    'mrr', CASE WHEN e.plano_atual = 'profissional' THEN 120000 ELSE 60000 END
  )
  FROM public.escolas e
  WHERE e.status = 'ativa'
  ORDER BY e.created_at DESC;
END;
$$;

COMMIT;
