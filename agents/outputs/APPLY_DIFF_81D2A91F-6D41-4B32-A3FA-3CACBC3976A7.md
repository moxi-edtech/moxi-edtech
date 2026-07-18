# KLASSE — Apply Diff
run_id: 81D2A91F-6D41-4B32-A3FA-3CACBC3976A7
timestamp: 2026-07-18T12:54:42Z
commit_base: dea66ad0

## P0 checklist

Todos os itens de `P0_CHECKLIST.md` estão marcados como PASS.

## Acção

Permitir busca tenant-safe de um insight específico para revisão WhatsApp.

## Diff proposto

```diff
--- a/apps/web/src/app/api/admin/ai/insights/route.ts
+++ b/apps/web/src/app/api/admin/ai/insights/route.ts
@@
 const listSchema = z.object({
+  id: z.string().uuid().optional(),
@@
+    id: url.searchParams.get("id") || undefined,
@@
+  if (parsed.data.id) query = query.eq("id", parsed.data.id);
```

## Risco e reversão

Risco baixo: filtro adicional continua subordinado a `school_id`, autenticação e RLS.

