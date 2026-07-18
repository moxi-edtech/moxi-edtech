# KLASSE — Apply Diff
run_id: B4749CEF-BBD7-40A0-BC56-770D4C697A4D
timestamp: 2026-07-18T12:55:30Z
commit_base: dea66ad0

## P0 checklist

Todos os itens de `P0_CHECKLIST.md` estão marcados como PASS.

## Acção

Associar mensagens WhatsApp individuais ao insight e motivo de seleção, com validação tenant.

## Diff proposto

```diff
--- a/apps/web/src/app/api/escola/[id]/admin/comunicacao/whatsapp/route.ts
+++ b/apps/web/src/app/api/escola/[id]/admin/comunicacao/whatsapp/route.ts
@@
+  aiInsightId: z.string().uuid().optional().nullable(),
+  selectionReason: z.string().trim().min(3).max(500).optional().nullable(),
@@
+  // valida insight dentro da escola e exige motivo quando presente
@@
-        metadata: { phone, variables: parsed.data.variables },
+        metadata: { phone, variables, ai_insight_id, ai_insight_tool_id, selection_reason },
```

## Risco e reversão

Risco baixo: campos opcionais, sem alteração de envio; insight é validado por escola antes da criação.

