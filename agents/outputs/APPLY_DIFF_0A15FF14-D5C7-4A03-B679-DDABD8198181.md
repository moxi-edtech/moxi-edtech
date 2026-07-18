# KLASSE — Apply Diff
run_id: 0A15FF14-D5C7-4A03-B679-DDABD8198181
timestamp: 2026-07-18T12:06:02Z
commit_base: dea66ad0

## P0 checklist

Todos os itens de `P0_CHECKLIST.md` estão marcados como PASS.

## Acção

Registrar `academic-low-attendance` no Data Copilot produtivo.

## Diff proposto

```diff
--- a/apps/web/src/lib/assistant/data-copilot/tool-registry.ts
+++ b/apps/web/src/lib/assistant/data-copilot/tool-registry.ts
@@
+import { academicLowAttendanceTool } from "./tools/academic-low-attendance";
@@
   admissionsPendingTool,
+  academicLowAttendanceTool,
```

## Risco e reversão

Risco baixo: adiciona ferramenta de leitura com intenção e permissão específicas.

