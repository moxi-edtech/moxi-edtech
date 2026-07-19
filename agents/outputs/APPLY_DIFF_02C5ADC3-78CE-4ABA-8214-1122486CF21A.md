# Apply diff — Agent 3
run_id:    02C5ADC3-78CE-4ABA-8214-1122486CF21A
timestamp: 2026-07-18T20:57:39Z

## Acção proposta

Adicionar guard de `service_role` ou super/global admin às três RPCs administrativas que hoje aceitam qualquer utilizador autenticado. Assinaturas, retornos, consultas e grants permanecem iguais.

## Diff

```diff
diff --git a/supabase/migrations/20270718140000_guard_admin_health_functions.sql b/supabase/migrations/20270718140000_guard_admin_health_functions.sql
new file mode 100644
--- /dev/null
+++ b/supabase/migrations/20270718140000_guard_admin_health_functions.sql
@@
+CREATE OR REPLACE FUNCTION public.admin_get_escola_health_metrics()
+RETURNS SETOF jsonb LANGUAGE plpgsql SECURITY DEFINER
+SET search_path TO 'pg_catalog', 'public', 'auth', 'extensions'
+AS $function$
+BEGIN
+  IF auth.role() <> 'service_role' AND NOT public.check_super_admin_role() THEN
+    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
+  END IF;
+
+  RETURN QUERY
+  SELECT jsonb_build_object(
+    'id', e.id, 'nome', e.nome, 'plano', e.plano_atual,
+    'onboarding_finalizado', e.onboarding_finalizado,
+    'alunos_ativos', (SELECT COUNT(*) FROM public.alunos a WHERE a.escola_id = e.id AND a.status = 'ativo'),
+    'professores', (SELECT COUNT(*) FROM public.professores p WHERE p.escola_id = e.id),
+    'turmas', (SELECT COUNT(*) FROM public.turmas t WHERE t.escola_id = e.id AND t.status_validacao = 'ativo'),
+    'ultimo_acesso', (SELECT created_at FROM public.audit_logs al WHERE al.escola_id = e.id ORDER BY created_at DESC LIMIT 1),
+    'progresso_onboarding', CASE WHEN e.onboarding_finalizado THEN 100 ELSE
+      (CASE WHEN EXISTS (SELECT 1 FROM public.turmas t WHERE t.escola_id = e.id) THEN 40 ELSE 0 END) +
+      (CASE WHEN EXISTS (SELECT 1 FROM public.professores p WHERE p.escola_id = e.id) THEN 30 ELSE 0 END) +
+      (CASE WHEN EXISTS (SELECT 1 FROM public.periodos_letivos pl WHERE pl.escola_id = e.id) THEN 30 ELSE 0 END)
+    END
+  )
+  FROM public.escolas e
+  WHERE e.status = 'ativa'
+  ORDER BY e.created_at DESC;
+END;
+$function$;
+
+CREATE OR REPLACE FUNCTION public.admin_get_system_health()
+RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
+SET search_path TO 'public'
+AS $function$
+DECLARE result jsonb;
+BEGIN
+  IF auth.role() <> 'service_role' AND NOT public.check_super_admin_role() THEN
+    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
+  END IF;
+
+  SELECT jsonb_build_object(
+    'escolas_ativas', (SELECT COUNT(*) FROM escolas WHERE status = 'ativa'),
+    'alunos_totais', (SELECT COUNT(*) FROM alunos WHERE status = 'ativo'),
+    'professores_totais', (SELECT COUNT(*) FROM professores),
+    'outbox_pending', (SELECT COUNT(*) FROM outbox_events WHERE status = 'pending'::public.outbox_status),
+    'outbox_retry', (SELECT COUNT(*) FROM outbox_events WHERE status = 'failed'::public.outbox_status),
+    'aggregates_synced', (SELECT COUNT(DISTINCT escola_id) FROM aggregates_financeiro WHERE sync_status = 'synced'),
+    'aggregates_pending', (SELECT COUNT(DISTINCT escola_id) FROM aggregates_financeiro WHERE sync_status = 'pending'),
+    'mrr_total', (SELECT SUM(CASE WHEN plano_atual = 'profissional' THEN 120000 ELSE 60000 END) FROM escolas WHERE status = 'ativa'),
+    'last_updated', NOW()
+  ) INTO result;
+  RETURN result;
+END;
+$function$;
+
+CREATE OR REPLACE FUNCTION public.admin_recalc_all_aggregates()
+RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
+SET search_path TO 'public'
+AS $function$
+DECLARE
+  escola_record record;
+  result jsonb := '{"processed": 0, "errors": []}'::jsonb;
+BEGIN
+  IF auth.role() <> 'service_role' AND NOT public.check_super_admin_role() THEN
+    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
+  END IF;
+
+  FOR escola_record IN SELECT id FROM escolas WHERE status = 'ativa' LOOP
+    BEGIN
+      PERFORM recalc_escola_financeiro_totals(escola_record.id, date_trunc('month', now())::date);
+      result := jsonb_set(result, '{processed}', to_jsonb((result->>'processed')::int + 1));
+    EXCEPTION WHEN OTHERS THEN
+      result := jsonb_set(result, '{errors}', (result->'errors') || jsonb_build_object('escola_id', escola_record.id, 'error', SQLERRM));
+    END;
+  END LOOP;
+  RETURN result;
+END;
+$function$;
```

## Verificação prevista

- Aplicar transaccionalmente com `ON_ERROR_STOP=1`.
- Confirmar os três guards em `pg_proc.prosrc`.
- Confirmar que grants permanecem: `anon=0`, `authenticated=3`, `service_role=3`.
- Testar que uma sessão sem JWT recebe SQLSTATE `42501`.
