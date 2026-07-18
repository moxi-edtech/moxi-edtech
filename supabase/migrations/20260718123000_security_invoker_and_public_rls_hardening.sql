BEGIN;

-- Views must execute with the caller's permissions and honor RLS on their
-- underlying relations.
ALTER VIEW public.vw_professor_pendencias SET (security_invoker = true);
ALTER VIEW public.vw_pagamentos_recentes_humanized SET (security_invoker = true);
ALTER VIEW public.vw_turmas_para_matricula SET (security_invoker = true);
ALTER VIEW public.vw_admin_matriculas_por_mes SET (security_invoker = true);
ALTER VIEW public.vw_formacao_curso_cockpit_metrics SET (security_invoker = true);
ALTER VIEW public.vw_pagamentos_status SET (security_invoker = true);
ALTER VIEW public.vw_formacao_relatorio_honorarios_aulas SET (security_invoker = true);
ALTER VIEW public.vw_formacao_conversion_stats SET (security_invoker = true);
ALTER VIEW public.vw_formacao_cohort_economics SET (security_invoker = true);
ALTER VIEW public.vw_formacao_course_economics SET (security_invoker = true);
ALTER VIEW public.vw_eventos_escola_unificados SET (security_invoker = true);
ALTER VIEW public.vw_formacao_estudante_progresso SET (security_invoker = true);
ALTER VIEW public.vw_financeiro_kpis_geral SET (security_invoker = true);
ALTER VIEW public.view_admissao_oportunidades_lista_espera SET (security_invoker = true);
ALTER VIEW public.vw_escola_estado_hoje SET (security_invoker = true);
ALTER VIEW public.vw_admin_dashboard_counts SET (security_invoker = true);
ALTER VIEW public.avisos SET (security_invoker = true);
ALTER VIEW public.vw_boletim_por_matricula SET (security_invoker = true);
ALTER VIEW public.vw_financeiro_reconciliacao_ledger SET (security_invoker = true);

ALTER TABLE public.admissao_protocol_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendario_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendario_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secretaria_avisos_snooze ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secretaria_prioridades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_support_tickets ENABLE ROW LEVEL SECURITY;

-- RLS does not protect TRUNCATE, so remove broad grants inherited from
-- database defaults before restoring the minimum required privileges.
REVOKE ALL ON TABLE public.admissao_protocol_sequences FROM anon, authenticated;
REVOKE ALL ON TABLE public.calendario_templates FROM anon, authenticated;
REVOKE ALL ON TABLE public.calendario_template_items FROM anon, authenticated;
REVOKE ALL ON TABLE public.public_rate_limits FROM anon, authenticated;
REVOKE ALL ON TABLE public.idempotency_keys FROM anon, authenticated;
REVOKE ALL ON TABLE public.secretaria_avisos_snooze FROM anon, authenticated;
REVOKE ALL ON TABLE public.secretaria_prioridades FROM anon, authenticated;
REVOKE ALL ON TABLE public.partner_support_tickets FROM anon, authenticated;

-- Official global catalogue: authenticated read-only access.
GRANT SELECT ON TABLE public.calendario_templates TO authenticated;
GRANT SELECT ON TABLE public.calendario_template_items TO authenticated;

CREATE POLICY calendario_templates_select_authenticated
ON public.calendario_templates
FOR SELECT TO authenticated
USING (true);

CREATE POLICY calendario_template_items_select_authenticated
ON public.calendario_template_items
FOR SELECT TO authenticated
USING (true);

-- Idempotency records are directly accessible only inside the current tenant.
GRANT SELECT, INSERT, UPDATE ON TABLE public.idempotency_keys TO authenticated;

CREATE POLICY idempotency_keys_tenant_select
ON public.idempotency_keys
FOR SELECT TO authenticated
USING (escola_id = public.current_tenant_escola_id());

CREATE POLICY idempotency_keys_tenant_insert
ON public.idempotency_keys
FOR INSERT TO authenticated
WITH CHECK (escola_id = public.current_tenant_escola_id());

CREATE POLICY idempotency_keys_tenant_update
ON public.idempotency_keys
FOR UPDATE TO authenticated
USING (escola_id = public.current_tenant_escola_id())
WITH CHECK (escola_id = public.current_tenant_escola_id());

-- Read access is required by the invoker productivity function; mutations
-- remain restricted to the existing SECURITY DEFINER RPCs.
GRANT SELECT ON TABLE public.secretaria_avisos_snooze TO authenticated;
GRANT SELECT ON TABLE public.secretaria_prioridades TO authenticated;

CREATE POLICY secretaria_avisos_snooze_select_own_tenant
ON public.secretaria_avisos_snooze
FOR SELECT TO authenticated
USING (
  escola_id = public.current_tenant_escola_id()
  AND user_id = (SELECT auth.uid())
);

CREATE POLICY secretaria_prioridades_select_tenant
ON public.secretaria_prioridades
FOR SELECT TO authenticated
USING (escola_id = public.current_tenant_escola_id());

-- Sequences, rate limits, and partner tickets intentionally have no policies:
-- their access is mediated by SECURITY DEFINER RPCs or service_role.

COMMIT;
