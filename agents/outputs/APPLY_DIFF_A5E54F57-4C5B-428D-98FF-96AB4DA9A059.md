# Apply diff — Agent 3
run_id: A5E54F57-4C5B-428D-98FF-96AB4DA9A059
timestamp: 2026-07-18T00:00:00-03:00

## Acção proposta

Migrar `recalcAllAggregates` da execução RPC autenticada para envio de evento Inngest após guarda explícita de Super Admin.

## Diff

```diff
+import { inngest } from '@/inngest/client';
+import { requireSuperAdminRoute } from '@/lib/auth/requireSuperAdminRoute';
@@
-  const supabase = await createClient();
-  const { data, error } = await supabase.rpc('admin_recalc_all_aggregates');
+  const auth = await requireSuperAdminRoute();
+  if (!auth.ok) return { success: false, error: 'Somente Super Admin' };
+  const event = await inngest.send({
+    name: 'admin/health.recalc-all-aggregates.requested',
+    data: { requested_by: auth.user.id },
+  });
```

## Verificação prévia

- `P0_CHECKLIST.md`: nenhum FAIL.
- Worker criado, registado e com typecheck PASS.
- A ação deixa de manipular `service_role` e apenas publica um evento após autenticação/autorização.

## Reversão

Restaurar a chamada RPC anterior enquanto `authenticated` ainda conserva temporariamente `EXECUTE`.
