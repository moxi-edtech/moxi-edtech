# Apply diff — Agent 3
run_id:    20260318-app-klasse-domain
timestamp: 2026-03-18T18:01:28.374265+00:00

## Acção proposta
Alinhar o app project e os fallbacks de URLs transacionais para `app.klasse.ao`, evitando que o código continue a emitir links para o domínio legado `portal.klasse.ao` e documentando o redirect esperado no deployment do app.

## Diff
```diff
--- a/apps/web/src/app/api/jobs/outbox/route.ts
+++ b/apps/web/src/app/api/jobs/outbox/route.ts
@@
-  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://portal.klasse.ao").replace(/\/$/, "");
+  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://app.klasse.ao").replace(/\/$/, "");

--- /dev/null
+++ b/apps/web/vercel.json
@@
+{
+  "redirects": [
+    {
+      "source": "/",
+      "has": [
+        {
+          "type": "host",
+          "value": "app.klasse.ao"
+        }
+      ],
+      "destination": "/redirect",
+      "permanent": false
+    }
+  ]
+}
```

## Risco
Baixo: muda apenas o domínio fallback de links do worker e explicita o redirect do root no projecto web; não altera schema nem dados.
