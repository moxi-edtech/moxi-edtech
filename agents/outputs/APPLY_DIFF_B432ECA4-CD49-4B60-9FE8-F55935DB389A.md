# Apply Diff — Cobrança individual por WhatsApp

run_id: B432ECA4-CD49-4B60-9FE8-F55935DB389A  
data: 2026-08-02  
ficheiro alvo: `apps/web/src/app/escola/[id]/(portal)/financeiro/cobrancas/CarteiraCobrancasClient.tsx`

## Objetivo

Restaurar na carteira consolidada a ação de cobrança individual pelo WhatsApp WAHA.

## Diff proposto

```diff
+ confirmação antes do envio
+ POST para `/api/escola/[id]/admin/comunicacao/whatsapp/bulk`
+ mensagem de propina em atraso com aluno e valor
+ estado de envio e retorno por toast
+ botão WhatsApp em cada aluno com saldo em atraso
```

## Risco

Baixo. Reutiliza o endpoint e o contrato de payload já usados pela tela legada, limitado a um aluno por confirmação.

## Reversão

Remover o handler, o estado e o botão WhatsApp do componente.
