# Apply Diff — Sincronizar vista financeira após rewrite

run_id: 59B9A68C-6E53-4DFA-8C9A-7F26EEA875E6  
data: 2026-08-02  
ficheiro alvo: `apps/web/src/app/escola/[id]/(portal)/financeiro/tabelas-mensalidade/MensalidadesPrecosWorkspace.tsx`

## Objetivo

Preservar `?view=precos` após recarga quando o rewrite não propaga a vista inicial ao componente servidor.

## Diff proposto

```diff
-import { useState } from "react";
+import { useEffect, useState } from "react";
+
+useEffect(() => {
+  const requestedView = new URLSearchParams(window.location.search).get("view");
+  if (!isWorkspaceView(requestedView) || requestedView === view) return;
+  const frame = window.requestAnimationFrame(() => setView(requestedView));
+  return () => window.cancelAnimationFrame(frame);
+}, [view]);
```

## Risco

Baixo. A atualização ocorre no próximo frame e somente quando URL e estado divergem.

## Reversão

Remover o efeito de sincronização.
