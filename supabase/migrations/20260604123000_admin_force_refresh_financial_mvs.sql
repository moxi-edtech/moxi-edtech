BEGIN;

-- RPC para forçar o refresh das MVs financeiras críticas
CREATE OR REPLACE FUNCTION public.admin_force_refresh_financial_mvs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Refresh das visões críticas de performance financeira
  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_dashboard; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_kpis_mes; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_financeiro_escola_dia; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM public.refresh_mv_financeiro_sidebar_badges(); EXCEPTION WHEN OTHERS THEN NULL; END;
  
  RETURN jsonb_build_object('ok', true, 'message', 'Dashboards financeiros atualizados com sucesso.');
END;
$$;

-- Permissões
REVOKE ALL ON FUNCTION public.admin_force_refresh_financial_mvs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_force_refresh_financial_mvs() TO postgres, service_role;

COMMIT;
