# KLASSE — Apply Diff
run_id: 991F71EC-B750-4C73-BE26-F04AC9644FB1
timestamp: 2026-07-18T12:55:58Z
commit_base: dea66ad0

## P0 checklist

Todos os itens de `P0_CHECKLIST.md` estão marcados como PASS.

## Acção

Levar insight e motivo do cockpit à Central WhatsApp e exibi-los na revisão junto aos destinatários.

## Diff proposto

```diff
--- a/apps/web/src/app/escola/[id]/(portal)/admin/comunicacao/whatsapp/page.tsx
+++ b/apps/web/src/app/escola/[id]/(portal)/admin/comunicacao/whatsapp/page.tsx
@@
-import { usePathname } from "next/navigation";
+import { usePathname, useSearchParams } from "next/navigation";
@@
+type InsightOrigin = { id; title; module; tool_id; explanation; recommendation; evidence };
@@
+// lê aiInsightId, carrega origem pela API tenant-safe e preenche motivo/rascunho
@@
+// envia aiInsightId + selectionReason nos payloads individual e bulk
@@
+// mostra card de revisão com origem, motivo editável e destinatários selecionados
```

## Risco e reversão

Risco baixo: contexto de URL é revalidado no servidor; a UI apenas prepara/revisa e não envia automaticamente.

