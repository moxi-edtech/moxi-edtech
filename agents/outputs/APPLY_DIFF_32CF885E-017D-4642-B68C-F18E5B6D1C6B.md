# KLASSE — Apply Diff
run_id: 32CF885E-017D-4642-B68C-F18E5B6D1C6B
timestamp: 2026-07-18T12:29:34Z
commit_base: dea66ad0

## P0 checklist

Todos os itens de `P0_CHECKLIST.md` estão marcados como PASS.

## Acção

Renderizar respostas de Data Copilot como cards editoriais estruturados no widget.

## Diff proposto

```diff
--- a/apps/web/src/components/ai/AiChatWidget.tsx
+++ b/apps/web/src/components/ai/AiChatWidget.tsx
@@
+type InsightPayload = { diagnosis; impact; recommendation; evidence; actions };
@@
 type Message = {
+  mode?: string;
+  insight?: InsightPayload;
@@
 type AssistantResponsePayload = {
+  operatingMode?: "help" | "data" | "action";
+  insight?: InsightPayload;
@@
+// propaga mode/insight do cache e da API
+// renderiza Diagnóstico, Impacto, Próximo passo e Evidências em card semântico
```

## Risco e reversão

Risco baixo: alteração somente visual com fallback integral para mensagens antigas sem payload estruturado.

