# Apply Diff — Ativar workspace de mensalidades e preços

run_id: D0E57DB8-C4F2-4582-89F8-69C19D6F1FC4  
data: 2026-08-02  
ficheiro alvo: `apps/web/src/app/escola/[id]/(portal)/financeiro/tabelas-mensalidade/page.tsx`

## Objetivo

Substituir a página isolada de tabelas pelo workspace unificado.

## Diff proposto

```diff
-import TabelasMensalidadeClient from '@/components/financeiro/TabelasMensalidadeClient'
+import MensalidadesPrecosWorkspace from "./MensalidadesPrecosWorkspace";
...
-      <TabelasMensalidadeClient />
+      <MensalidadesPrecosWorkspace />
```

## Risco

Baixo. A rota e o componente anterior permanecem, agora dentro da vista padrão do workspace.

## Reversão

Restaurar a renderização direta de `TabelasMensalidadeClient`.
