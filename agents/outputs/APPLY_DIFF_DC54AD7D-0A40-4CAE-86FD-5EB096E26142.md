# Apply Diff — Fluxo canónico de recebimento na carteira

run_id: DC54AD7D-0A40-4CAE-86FD-5EB096E26142  
data: 2026-08-02  
ficheiro alvo: `apps/web/src/app/escola/[id]/(portal)/financeiro/cobrancas/CarteiraCobrancasClient.tsx`

## Objetivo

Substituir o modal financeiro simplificado pelo fluxo canónico `ModalPagamentoRapido`, já utilizado pela Secretaria.

## Diff proposto

```diff
- seleção local de propina + RegistoPagamentoModal
+ ModalPagamentoRapido com todas as propinas pendentes do aluno
+ primeira propina cronológica pré-selecionada
+ pagamentos múltiplos/parciais, idempotência, recibo, fiscalidade e reversão
+ recarga da carteira após sucesso
```

## Risco

Baixo. Reutilização de componente e endpoint existentes, sem alteração de schema, RLS ou contrato SQL.

## Reversão

Restaurar o modal financeiro simplificado no componente da carteira.
