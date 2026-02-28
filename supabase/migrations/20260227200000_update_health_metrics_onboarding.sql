-- Migration: 20260227200000_update_health_metrics_onboarding.sql
-- Description: Atualiza a RPC de saúde para incluir status de onboarding real.

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
    'onboarding_finalizado', e.onboarding_finalizado,
    'alunos_ativos', (SELECT COUNT(*) FROM public.alunos a WHERE a.escola_id = e.id AND a.status = 'ativo'),
    'professores', (SELECT COUNT(*) FROM public.professores p WHERE p.escola_id = e.id),
    'turmas', (SELECT COUNT(*) FROM public.turmas t WHERE t.escola_id = e.id AND t.status_validacao = 'ativo'),
    'ultimo_acesso', (SELECT created_at FROM public.audit_logs al WHERE al.escola_id = e.id ORDER BY created_at DESC LIMIT 1),
    'progresso_onboarding', CASE 
      WHEN e.onboarding_finalizado THEN 100
      ELSE (
        (CASE WHEN EXISTS (SELECT 1 FROM public.turmas t WHERE t.escola_id = e.id) THEN 40 ELSE 0 END) +
        (CASE WHEN EXISTS (SELECT 1 FROM public.professores p WHERE p.escola_id = e.id) THEN 30 ELSE 0 END) +
        (CASE WHEN EXISTS (SELECT 1 FROM public.periodos_letivos pl WHERE pl.escola_id = e.id) THEN 30 ELSE 0 END)
      )
    END
  )
  FROM public.escolas e
  WHERE e.status = 'ativa'
  ORDER BY e.created_at DESC;
END;
$$;

COMMIT;
