-- 1) Backup/test tables must not be reachable through the public Data API.
ALTER TABLE public._bk_20260924_curso_matriz ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._bk_20260924_turma_disciplinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._bk_20260924_avaliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._bk_20260924_notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._bk_20260924_mensalidades_caroline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._bk_20260924_alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._bk_20260924_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._bk_20260924b_mensalidades_teta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_regime_contract_cases ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public._bk_20260924_curso_matriz,
  public._bk_20260924_turma_disciplinas,
  public._bk_20260924_avaliacoes,
  public._bk_20260924_notas,
  public._bk_20260924_mensalidades_caroline,
  public._bk_20260924_alunos,
  public._bk_20260924_profiles,
  public._bk_20260924b_mensalidades_teta,
  public.academic_regime_contract_cases
FROM PUBLIC, anon, authenticated;

-- 2) Trigger functions are invoked by PostgreSQL triggers, not by client RPC calls.
REVOKE EXECUTE ON FUNCTION public.audit_excecao_pauta_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_mensalidade_matricula_scope() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_default_raa_policy() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_matricula_financial_start() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_turma_academic_year() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_aplicar_desconto_familiar() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_education_offering_calendar_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_k12_offering_curriculum_preset() FROM PUBLIC, anon, authenticated;

-- 3) Internal helper is only called by the validated public wrapper / privileged backend.
REVOKE EXECUTE ON FUNCTION public.aplicar_desconto_familiar_interno(uuid, uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_desconto_familiar_interno(uuid, uuid) TO service_role;

-- 4) MV refresh is maintenance-only.
REVOKE EXECUTE ON FUNCTION public.refresh_mv_financeiro_escola_dia_ano()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_mv_financeiro_escola_dia_ano() TO service_role;

-- 5) Finance reporting view can safely be SECURITY INVOKER because authenticated
-- already has SELECT on the backing materialized view.
ALTER VIEW public.vw_financeiro_escola_dia_ano SET (security_invoker = true);
REVOKE ALL ON TABLE public.vw_financeiro_escola_dia_ano FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.vw_financeiro_escola_dia_ano TO authenticated, service_role;

REVOKE ALL ON TABLE internal.mv_financeiro_escola_dia_ano FROM PUBLIC, anon;
GRANT SELECT ON TABLE internal.mv_financeiro_escola_dia_ano TO authenticated, service_role;

