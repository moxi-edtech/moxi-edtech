# Apply Diff — Workspace unificado de Recebimentos

run_id: ADDD07ED-F776-48C0-A3DD-2B78CB213F13  
data: 2026-08-02  
ficheiro alvo: `apps/web/src/app/escola/[id]/(portal)/financeiro/recebimentos/page.tsx`

## Objetivo

Unificar validação e histórico de pagamentos num único workspace chamado Recebimentos.

## Capacidades

- aba `Por validar` com a fila já utilizada pela Secretaria;
- aba `Histórico` com pagamentos confirmados e reversão;
- filtros de período, pesquisa e exportação;
- ação `Registar recebimento` através da carteira consolidada;
- `force-dynamic` e dados financeiros sem cache.

## Risco

Baixo. Nova rota que compõe componentes existentes sem remover as rotas legadas.

## Reversão

Remover a nova página.
