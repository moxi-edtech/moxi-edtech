BEGIN;

ALTER VIEW public.vw_top_cursos_media SET (security_invoker = true);
ALTER VIEW public.presencas SET (security_invoker = true);
ALTER VIEW public.vw_super_admin_audit_metrics SET (security_invoker = true);
ALTER VIEW public.vw_top_turmas_hoje SET (security_invoker = true);
ALTER VIEW public.vw_pagamentos_status SET (security_invoker = true);
ALTER VIEW public.vw_financeiro_escola_dia SET (security_invoker = true);
ALTER VIEW public.vw_financeiro_missing_pricing_count SET (security_invoker = true);
ALTER VIEW public.vw_boletim_por_matricula SET (security_invoker = true);
ALTER VIEW public.vw_escola_cursos_stats SET (security_invoker = true);
ALTER VIEW public.vw_financeiro_dashboard SET (security_invoker = true);
ALTER VIEW public.vw_super_admin_escola_metrics SET (security_invoker = true);
ALTER VIEW public.vw_financeiro_propinas_mensal_escola SET (security_invoker = true);
ALTER VIEW public.vw_balcao_secretaria SET (security_invoker = true);
ALTER VIEW public.vw_escola_info SET (security_invoker = true);
ALTER VIEW public.vw_freq_por_turma_dia SET (security_invoker = true);
ALTER VIEW public.vw_financeiro_propinas_por_turma SET (security_invoker = true);

COMMIT;
