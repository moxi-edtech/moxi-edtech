# Diff proposto — hardening de views e RLS
run_id: AA33F63A-459D-4A31-90CD-9C90E00AD511
timestamp: 2026-07-18T12:28:03Z
commit_base: dea66ad0

```diff
*** Add File: supabase/migrations/20260718123000_security_invoker_and_public_rls_hardening.sql
+BEGIN;
+
+-- Views devem executar com as permissões do chamador e respeitar o RLS
+-- das relações subjacentes.
+ALTER VIEW public.vw_professor_pendencias SET (security_invoker = true);
+ALTER VIEW public.vw_pagamentos_recentes_humanized SET (security_invoker = true);
+ALTER VIEW public.vw_turmas_para_matricula SET (security_invoker = true);
+ALTER VIEW public.vw_admin_matriculas_por_mes SET (security_invoker = true);
+ALTER VIEW public.vw_formacao_curso_cockpit_metrics SET (security_invoker = true);
+ALTER VIEW public.vw_pagamentos_status SET (security_invoker = true);
+ALTER VIEW public.vw_formacao_relatorio_honorarios_aulas SET (security_invoker = true);
+ALTER VIEW public.vw_formacao_conversion_stats SET (security_invoker = true);
+ALTER VIEW public.vw_formacao_cohort_economics SET (security_invoker = true);
+ALTER VIEW public.vw_formacao_course_economics SET (security_invoker = true);
+ALTER VIEW public.vw_eventos_escola_unificados SET (security_invoker = true);
+ALTER VIEW public.vw_formacao_estudante_progresso SET (security_invoker = true);
+ALTER VIEW public.vw_financeiro_kpis_geral SET (security_invoker = true);
+ALTER VIEW public.view_admissao_oportunidades_lista_espera SET (security_invoker = true);
+ALTER VIEW public.vw_escola_estado_hoje SET (security_invoker = true);
+ALTER VIEW public.vw_admin_dashboard_counts SET (security_invoker = true);
+ALTER VIEW public.avisos SET (security_invoker = true);
+ALTER VIEW public.vw_boletim_por_matricula SET (security_invoker = true);
+ALTER VIEW public.vw_financeiro_reconciliacao_ledger SET (security_invoker = true);
+
+ALTER TABLE public.admissao_protocol_sequences ENABLE ROW LEVEL SECURITY;
+ALTER TABLE public.calendario_templates ENABLE ROW LEVEL SECURITY;
+ALTER TABLE public.calendario_template_items ENABLE ROW LEVEL SECURITY;
+ALTER TABLE public.public_rate_limits ENABLE ROW LEVEL SECURITY;
+ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
+ALTER TABLE public.secretaria_avisos_snooze ENABLE ROW LEVEL SECURITY;
+ALTER TABLE public.secretaria_prioridades ENABLE ROW LEVEL SECURITY;
+ALTER TABLE public.partner_support_tickets ENABLE ROW LEVEL SECURITY;
+
+-- RLS não cobre TRUNCATE: remover grants amplos concedidos por defaults.
+REVOKE ALL ON TABLE public.admissao_protocol_sequences FROM anon, authenticated;
+REVOKE ALL ON TABLE public.calendario_templates FROM anon, authenticated;
+REVOKE ALL ON TABLE public.calendario_template_items FROM anon, authenticated;
+REVOKE ALL ON TABLE public.public_rate_limits FROM anon, authenticated;
+REVOKE ALL ON TABLE public.idempotency_keys FROM anon, authenticated;
+REVOKE ALL ON TABLE public.secretaria_avisos_snooze FROM anon, authenticated;
+REVOKE ALL ON TABLE public.secretaria_prioridades FROM anon, authenticated;
+REVOKE ALL ON TABLE public.partner_support_tickets FROM anon, authenticated;
+
+-- Catálogo oficial global: somente leitura autenticada.
+GRANT SELECT ON TABLE public.calendario_templates TO authenticated;
+GRANT SELECT ON TABLE public.calendario_template_items TO authenticated;
+
+CREATE POLICY calendario_templates_select_authenticated
+ON public.calendario_templates
+FOR SELECT TO authenticated
+USING (true);
+
+CREATE POLICY calendario_template_items_select_authenticated
+ON public.calendario_template_items
+FOR SELECT TO authenticated
+USING (true);
+
+-- Idempotência: acesso direto apenas dentro do tenant atual.
+GRANT SELECT, INSERT, UPDATE ON TABLE public.idempotency_keys TO authenticated;
+
+CREATE POLICY idempotency_keys_tenant_select
+ON public.idempotency_keys
+FOR SELECT TO authenticated
+USING (escola_id = public.current_tenant_escola_id());
+
+CREATE POLICY idempotency_keys_tenant_insert
+ON public.idempotency_keys
+FOR INSERT TO authenticated
+WITH CHECK (escola_id = public.current_tenant_escola_id());
+
+CREATE POLICY idempotency_keys_tenant_update
+ON public.idempotency_keys
+FOR UPDATE TO authenticated
+USING (escola_id = public.current_tenant_escola_id())
+WITH CHECK (escola_id = public.current_tenant_escola_id());
+
+-- Leitura necessária à função invoker de produtividade; mutações ficam nos RPCs.
+GRANT SELECT ON TABLE public.secretaria_avisos_snooze TO authenticated;
+GRANT SELECT ON TABLE public.secretaria_prioridades TO authenticated;
+
+CREATE POLICY secretaria_avisos_snooze_select_own_tenant
+ON public.secretaria_avisos_snooze
+FOR SELECT TO authenticated
+USING (
+  escola_id = public.current_tenant_escola_id()
+  AND user_id = (SELECT auth.uid())
+);
+
+CREATE POLICY secretaria_prioridades_select_tenant
+ON public.secretaria_prioridades
+FOR SELECT TO authenticated
+USING (escola_id = public.current_tenant_escola_id());
+
+-- As quatro tabelas restantes não recebem policies intencionalmente:
+-- sequências, rate limits e tickets são acessados por RPC SECURITY DEFINER;
+-- service_role preserva bypass de RLS.
+
+COMMIT;
```

