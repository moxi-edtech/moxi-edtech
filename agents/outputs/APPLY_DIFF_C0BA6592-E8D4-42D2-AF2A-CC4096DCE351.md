# KLASSE — Apply Diff
run_id: C0BA6592-E8D4-42D2-AF2A-CC4096DCE351
timestamp: 2026-07-18T12:51:38Z
commit_base: dea66ad0

## P0 checklist

Todos os itens de `P0_CHECKLIST.md` estão marcados como PASS.

## Acção

Associar rascunhos e ações WhatsApp gerados pela IA ao `ai_insight` de origem, validando tenant.

## Diff proposto

```diff
--- a/apps/web/src/app/api/admin/ai/actions/save/route.ts
+++ b/apps/web/src/app/api/admin/ai/actions/save/route.ts
@@
 const saveSchema = z.object({
+  aiInsightId: z.string().uuid().optional().nullable(),
@@
+    const sourceInsight = parsed.data.aiInsightId
+      ? await supabase.from("ai_insights").select("id,tool_id,module").eq("id", ...).eq("school_id", schoolId).maybeSingle()
+      : null;
+    if (parsed.data.aiInsightId && !sourceInsight?.data) return 404;
@@
+      sourceEntityType: sourceInsight ? "ai_insights" : undefined,
+      sourceEntityId: sourceInsight?.id,
+      metadata: { ai_insight_id: sourceInsight?.id, ... },
@@
-          metadata: { phone, ai_action_id: action.id, assistant_v3: true },
+          metadata: { phone, ai_action_id: action.id, ai_insight_id: sourceInsight?.id, assistant_v3: true },
```

## Risco e reversão

Risco baixo: campo opcional, compatível com clientes atuais; IDs são aceitos somente quando pertencem à escola resolvida.

