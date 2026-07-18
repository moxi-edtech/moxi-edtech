# KLASSE — Apply Diff
run_id: 95F4B4C2-4F5E-4367-AEAA-3EBF67942044
timestamp: 2026-07-18T12:08:02Z
commit_base: dea66ad0

## P0 checklist

Todos os itens de `P0_CHECKLIST.md` estão marcados como PASS.

## Acção

Registrar `academic-grade-gaps` no Data Copilot produtivo.

## Diff proposto

```diff
--- a/apps/web/src/lib/assistant/data-copilot/tool-registry.ts
+++ b/apps/web/src/lib/assistant/data-copilot/tool-registry.ts
@@
+import { academicGradeGapsTool } from "./tools/academic-grade-gaps";
@@
   admissionsPendingTool,
+  academicGradeGapsTool,
   academicLowAttendanceTool,
```

## Risco e reversão

Risco baixo: adiciona ferramenta de leitura de MV com intenção e permissão específicas.

