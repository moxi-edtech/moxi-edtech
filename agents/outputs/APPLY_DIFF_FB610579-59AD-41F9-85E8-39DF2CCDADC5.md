# Apply diff — Agent 3
run_id:    FB610579-59AD-41F9-85E8-39DF2CCDADC5
timestamp: 2026-07-18T20:49:35Z

## Acção proposta

Fixar `search_path = public, extensions` nas 25 assinaturas que o catálogo remoto ainda reporta com search path mutável. A alteração não modifica corpos, assinaturas, ownership ou grants.

## Diff

```diff
diff --git a/supabase/migrations/20270718134000_fix_remaining_function_search_paths.sql b/supabase/migrations/20270718134000_fix_remaining_function_search_paths.sql
new file mode 100644
--- /dev/null
+++ b/supabase/migrations/20270718134000_fix_remaining_function_search_paths.sql
@@
+-- Pin function resolution to trusted schemas for the remaining linter findings.
+ALTER FUNCTION public.slugify(text) SET search_path = public, extensions;
+ALTER FUNCTION public.refresh_mv_relatorio_financeiro_escolar_capitacao_mensal() SET search_path = public, extensions;
+ALTER FUNCTION public.refresh_mv_admin_matriculas_por_mes() SET search_path = public, extensions;
+ALTER FUNCTION public.sync_user_role_to_auth() SET search_path = public, extensions;
+ALTER FUNCTION public.trg_validate_quadro_docente_alocacao() SET search_path = public, extensions;
+ALTER FUNCTION public.fn_prevent_attendance_on_holidays() SET search_path = public, extensions;
+ALTER FUNCTION public.sync_centro_formacao_status_from_assinatura() SET search_path = public, extensions;
+ALTER FUNCTION public.formacao_emitir_certificados_batch(uuid, uuid, uuid[]) SET search_path = public, extensions;
+ALTER FUNCTION public.get_turma_occupancy_history(uuid) SET search_path = public, extensions;
+ALTER FUNCTION public.get_turmas_pedagogico_stats(uuid) SET search_path = public, extensions;
+ALTER FUNCTION public.fn_ledger_insert_once(uuid, uuid, financeiro_tipo_transacao, financeiro_origem, text, uuid, text, integer, text, numeric, date, text, jsonb) SET search_path = public, extensions;
+ALTER FUNCTION public.fn_ledger_insert_once(uuid, uuid, text, text, text, uuid, text, integer, text, numeric, date, text, jsonb) SET search_path = public, extensions;
+ALTER FUNCTION public.snooze_secretaria_aviso(uuid, text, text, integer, timestamp with time zone) SET search_path = public, extensions;
+ALTER FUNCTION public.set_secretaria_priority(uuid, text, uuid, text) SET search_path = public, extensions;
+ALTER FUNCTION public.admissao_auto_expire_reservations() SET search_path = public, extensions;
+ALTER FUNCTION public.admissao_public_lookup_by_protocolo(uuid, text) SET search_path = public, extensions;
+ALTER FUNCTION public.admissao_reject(uuid, uuid, text, jsonb) SET search_path = public, extensions;
+ALTER FUNCTION public.admissao_reabrir(uuid, uuid, text) SET search_path = public, extensions;
+ALTER FUNCTION public.admissao_archive(uuid, uuid, text) SET search_path = public, extensions;
+ALTER FUNCTION public.onboarding_step_sort_order(text) SET search_path = public, extensions;
+ALTER FUNCTION public.fn_sync_financeiro_ledger() SET search_path = public, extensions;
+ALTER FUNCTION public.handle_crm_leads_updated_at() SET search_path = public, extensions;
+ALTER FUNCTION public.log_crm_lead_activity() SET search_path = public, extensions;
+ALTER FUNCTION public.handle_partner_task_updated_at() SET search_path = public, extensions;
+ALTER FUNCTION public.handle_crm_commercial_proposals_updated_at() SET search_path = public, extensions;
```

## Verificação prevista

- Executar a migration dentro de uma transacção com `ON_ERROR_STOP=1`.
- Consultar `pg_proc.proconfig` para as 25 assinaturas.
- Confirmar zero funções da lista sem `search_path=` explícito.
