# Apply Diff — Ações especializadas na carteira

run_id: 5C38B9FC-1D4E-49F3-AF8E-94F37DC2F49B  
data: 2026-08-02  
ficheiro alvo: `apps/web/src/app/escola/[id]/(portal)/financeiro/cobrancas/CarteiraCobrancasClient.tsx`

## Objetivo

Manter campanhas e operações em lote acessíveis a partir da nova entrada única de Cobranças.

## Diff proposto

```diff
+ botão `Ações por turma` → rota legada `turmas-alunos`
  botão `Campanhas de cobrança` → rota legada `radar`
```

## Risco

Baixo. Apenas navegação para capacidades já existentes.

## Reversão

Remover o novo botão de ações por turma.
