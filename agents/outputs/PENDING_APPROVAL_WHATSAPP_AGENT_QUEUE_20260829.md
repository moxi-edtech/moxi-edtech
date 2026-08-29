# Aprovação necessária — Agent 3
run_id:    WHATSAPP-AGENT-QUEUE-20260829
timestamp: 2026-08-28T23:45:00-03:00

## Acção proposta

Criar uma fila persistente para mensagens inbound do agente comercial WhatsApp, com deduplicação por mensagem, claim concorrente seguro e retry limitado. A migration é aditiva: não altera nem remove tabelas existentes.

## Diff

```diff
new file: supabase/migrations/20260829100000_whatsapp_agent_inbox_queue.sql
+CREATE TABLE public.whatsapp_agent_inbox_events (...)
+UNIQUE (session_name, provider_message_id)
+UNIQUE (communication_message_id)
+INDEX (session_name, status, available_at, created_at)
+FUNCTION public.claim_whatsapp_agent_inbox(...)
+FOR UPDATE SKIP LOCKED
+REVOKE access from public, anon, authenticated
+GRANT access only to service_role
```

O diff exacto está no ficheiro `supabase/migrations/20260829100000_whatsapp_agent_inbox_queue.sql`.

## Risco

A criação de tabela, índices, função SECURITY DEFINER e grants altera o schema de produção. Se aplicada incorretamente, o worker pode não conseguir reclamar eventos ou a fila pode acumular pendências; não há DROP, TRUNCATE ou alteração de dados existentes.

## Pré-condições verificadas

- `P0_CHECKLIST.md`: todos os itens P0 estão marcados como concluídos.
- O webhook existente já valida assinatura e grava inbound em `communication_messages`.
- A sessão WAHA está operacional, mas ainda sem webhook configurado (`config: {}`).

## Como aprovar

Commit com mensagem: `APPROVE: WHATSAPP-AGENT-QUEUE-20260829`

## Como rejeitar

Commit com mensagem: `REJECT: WHATSAPP-AGENT-QUEUE-20260829 [motivo]`
