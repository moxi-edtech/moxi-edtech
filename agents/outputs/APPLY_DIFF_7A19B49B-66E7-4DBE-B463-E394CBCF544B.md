# KLASSE — Apply Diff
run_id: 7A19B49B-66E7-4DBE-B463-E394CBCF544B
timestamp: 2026-07-18T12:23:41Z
commit_base: dea66ad0

## P0 checklist

Todos os itens de `P0_CHECKLIST.md` estão marcados como PASS.

## Acção

Criar endpoint protegido para listar insights e gerar/persistir o briefing diário.

## Diff proposto

```diff
diff --git a/apps/web/src/app/api/admin/ai/insights/route.ts b/apps/web/src/app/api/admin/ai/insights/route.ts
new file mode 100644
--- /dev/null
+++ b/apps/web/src/app/api/admin/ai/insights/route.ts
@@
+export const dynamic = "force-dynamic";
+export const revalidate = 0;
+
+export async function GET(req: Request) {
+  // valida filtros, autenticação, resolveEscolaIdForUser e papel
+  // lista ai_insights por escola, com limite máximo 50
+}
+
+export async function POST(req: Request) {
+  // valida escola e perfil
+  // executa schoolDailyBriefingTool
+  // persiste via upsertAiInsight com fingerprint diário
+}
```

## Risco e reversão

Risco baixo: endpoint no-store, isolado por escola, sem service role, com limite máximo e escrita idempotente protegida por RLS.

