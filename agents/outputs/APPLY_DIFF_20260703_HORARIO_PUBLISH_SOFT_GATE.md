# Apply Diff — Horario Publish Soft Gate
run_id:    20260703_HORARIO_PUBLISH_SOFT_GATE
timestamp: 2026-07-03T07:00:00-03:00

## Acção proposta
Permitir publicar o quadro mesmo com cargas horárias pendentes ou divergentes, devolvendo avisos estruturados e mantendo a correcção posterior em poucos cliques na própria UI.

## Diff
```diff
--- a/apps/web/src/app/api/escolas/[id]/horarios/quadro/route.ts
+++ b/apps/web/src/app/api/escolas/[id]/horarios/quadro/route.ts
@@
-      if (missing.length > 0 || mismatch.length > 0) {
-        return NextResponse.json(
-          { ok: false, error: 'CARGA_HORARIA_INCOMPLETA', details: { missing, mismatch } },
-          { status: 400 }
-        )
-      }
+      if (missing.length > 0 || mismatch.length > 0) {
+        publishWarnings.push(...)
+      }
@@
-      const response = NextResponse.json({ ok: true, versao_id: ..., status: 'publicada', items: data || [] })
+      const response = NextResponse.json({ ok: true, versao_id: ..., status: 'publicada', items: data || [], warnings: publishWarnings })

--- a/apps/web/src/app/escola/[id]/(portal)/horarios/quadro/page.tsx
+++ b/apps/web/src/app/escola/[id]/(portal)/horarios/quadro/page.tsx
@@
-  const canPublicar = missingLoadCount === 0;
+  const canPublicar = true;
@@
-            <div className="mt-1">Defina as cargas para publicar o quadro.</div>
+            <div className="mt-1">Pode publicar agora e ajustar as cargas depois em poucos cliques.</div>
@@
-            onPublicar={handlePublicar}
-            canPublicar={canPublicar}
-            publishDisabledReason={canPublicar ? undefined : "Defina todas as cargas horárias antes de publicar."}
+            onPublicar={handlePublicar}
+            canPublicar={canPublicar}
+            publishDisabledReason={undefined}
@@
+      if (mode === "publish" && Array.isArray(json?.warnings) && json.warnings.length > 0) {
+        warning("Quadro publicado com pendências", ...)
+      }
```

## Risco
O sistema passa a aceitar publicação de quadros incompletos do ponto de vista de carga horária, exigindo que os consumidores tratem `warnings` como estado operacional válido.
