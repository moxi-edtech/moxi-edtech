-- Migration: 20260127_admin_health_dashboard_rpcs.sql
-- Description: Adds RPC functions needed for the admin health dashboard.

BEGIN;

-- RPC function to get a snapshot of system health metrics.
-- This function is intended for the super admin dashboard.
CREATE OR REPLACE FUNCTION admin_get_system_health()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'escolas_ativas', (SELECT COUNT(*) FROM escolas WHERE status = 'ativa'),
    'alunos_totais', (SELECT COUNT(*) FROM alunos WHERE status = 'ativo'),
    'professores_totais', (SELECT COUNT(*) FROM professores),
    'outbox_pending', (SELECT COUNT(*) FROM outbox_events WHERE status = 'pending'::public.outbox_status),
    'outbox_retry', (SELECT COUNT(*) FROM outbox_events WHERE status = 'failed'::public.outbox_status),
    'aggregates_synced', (SELECT COUNT(DISTINCT escola_id) FROM aggregates_financeiro WHERE sync_status = 'synced'),
    'aggregates_pending', (SELECT COUNT(DISTINCT escola_id) FROM aggregates_financeiro WHERE sync_status = 'pending'),
    'mrr_total', (SELECT SUM(CASE WHEN plano_atual = 'profissional' THEN 120000 ELSE 60000 END) 
                  FROM escolas WHERE status = 'ativa'),
    'last_updated', NOW()
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC function to trigger a recalculation of all aggregates for all active schools.
-- This is a heavy operation and should be used with caution.
CREATE OR REPLACE FUNCTION admin_recalc_all_aggregates()
RETURNS JSONB AS $$
DECLARE
  escola_record RECORD;
  result JSONB := '{"processed": 0, "errors": []}'::JSONB;
BEGIN
  FOR escola_record IN SELECT id FROM escolas WHERE status = 'ativa'
  LOOP
    BEGIN
      PERFORM recalc_escola_financeiro_totals(escola_record.id, DATE_TRUNC('month', NOW())::DATE);
      result := jsonb_set(result, '{processed}', (result->>'processed')::int + 1);
    EXCEPTION WHEN OTHERS THEN
      result := jsonb_set(result, '{errors}', 
        (result->'errors') || jsonb_build_object('escola_id', escola_record.id, 'error', SQLERRM));
    END;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
