# Apply Diff — Corrigir retorno para Inadimplência

run_id: 90A76B5A-8E3A-42DA-A012-AACBFCE5B1DF  
data: 2026-08-01  
ficheiro alvo: `apps/web/src/app/escola/[id]/(portal)/financeiro/turmas-alunos/page.tsx`

## Objetivo

Preservar o segmento Financeiro ao voltar de Alunos e turmas para Inadimplência.

## Diff proposto

```diff
-new URL("../radar", window.location.href)
+new URL("../financeiro/radar", window.location.href)
```

## Risco

Baixo. Correção de destino de navegação no mesmo origin.

## Reversão

Restaurar o valor anterior.
