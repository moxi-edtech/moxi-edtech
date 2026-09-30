# Aprovação necessária — Agent 3
run_id:    51fc910e-e33c-41b1-8eb5-e61689eb9eac
timestamp: 2026-09-30T09:26:12Z

## Acção proposta

Corrigir o P1 aberto no PR #136 tornando o checkout multi-item da Secretaria atomicamente transacional.

A mudança proposta:

1. adiciona a RPC `financeiro_registrar_pagamentos_secretaria_batch`, que:
   - valida tenant/role;
   - aceita 1–50 itens;
   - serializa concorrência pela chave do checkout com `pg_advisory_xact_lock`;
   - usa uma chave filha `<batch-key>:<index>` por pagamento;
   - chama o writer canónico `financeiro_registrar_pagamento_secretaria` dentro de **uma única transação Postgres**;
   - replica as guardas de mensalidade, matrícula, ano letivo e janela de cobrança necessárias ao fluxo;
   - rejeita estado parcial preexistente em vez de “completar” silenciosamente;
   - devolve todos os pagamentos e marca retries completos como idempotentes.

2. altera `/api/secretaria/pagamentos/processar`:
   - mantém o caminho canónico existente para checkout de 1 item;
   - usa uma única chamada RPC batch para 2+ itens;
   - emite/enriquece recibo somente após commit bem-sucedido;
   - não reemite recibo automaticamente em retry idempotente;
   - preserva audit trail e o contrato de resposta.

3. altera `BalcaoAtendimento` para reutilizar a mesma `Idempotency-Key` quando o utilizador repete exactamente o mesmo checkout após timeout/erro de rede.

O P0 checklist foi verificado antes desta proposta e está integralmente marcado como concluído.

## Diff

O diff exacto proposto, incluindo o SQL completo da migration e os hunks exactos de API/UI, está versionado em:

`agents/outputs/APPLY_DIFF_51fc910e-e33c-41b1-8eb5-e61689eb9eac.md`

Migration reservada pelo comando oficial `supabase migration new fix_secretaria_batch_payment_atomicity`:

`supabase/migrations/20260930092612_fix_secretaria_batch_payment_atomicity.sql`

Resumo dos ficheiros funcionais que serão alterados somente após aprovação:

```diff
+ supabase/migrations/20260930092612_fix_secretaria_batch_payment_atomicity.sql
~ apps/web/src/app/api/secretaria/pagamentos/processar/route.ts
~ apps/web/src/components/secretaria/BalcaoAtendimento.tsx
```

Nenhum SQL remoto, migration repair, merge ou deployment de Production faz parte deste apply.

## Risco

A migration cria um novo contrato SQL financeiro e executa writes em `pagamentos` através do writer canónico. Se a validação batch estiver errada, o impacto possível é bloqueio indevido de checkout ou alteração da semântica de recebimento multi-item.

Mitigações obrigatórias antes de qualquer merge/deploy:

- testar primeiro em ambiente local/descartável;
- provar rollback integral quando um item posterior falha;
- provar idempotência e concorrência;
- manter checkout de item único no caminho canónico actual;
- KF2 verde;
- build/preview Next/Vercel verde;
- nenhuma aplicação remota em produção durante a validação.

Rollback de código: `git revert` dos commits deste run.
A migration ainda não foi aplicada ao Supabase remoto, portanto não existe rollback de banco a executar neste momento.

## Aprovação

Aprovado explicitamente pelo responsável em 2026-09-30.

Commit de aprovação: `APPROVE: 51fc910e-e33c-41b1-8eb5-e61689eb9eac`

## Como rejeitar

Commit com mensagem:

`REJECT: 51fc910e-e33c-41b1-8eb5-e61689eb9eac [motivo]`
