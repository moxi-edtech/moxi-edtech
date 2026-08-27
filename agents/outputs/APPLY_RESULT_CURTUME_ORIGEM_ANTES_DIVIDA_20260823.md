# Resultado da aplicação — Curtume: origem antes da dívida

run_id: CURTUME-ORIGEM-ANTES-DIVIDA-20260823
timestamp: 2026-08-23T00:00:00-03:00
migration: `20270823210000_allow_closed_origin_rematricula_activation`
status: APPLIED

## Evidência

- PostgreSQL: `BEGIN`, `CREATE FUNCTION`, `REVOKE`, `GRANT`, `COMMIT` concluídos.
- Histórico Supabase: versão registada como `allow_closed_origin_rematricula_activation`.
- RPC `finalizar_rematricula_balcao`: `SECURITY DEFINER`, `search_path=public`.
- Permissões: `authenticated = EXECUTE`, `anon = sem EXECUTE`.
- Contrato validado: aceita `concluido`/`concluida`, usa `historico_anos` e não grava mais `status = transferido` na origem.

## Efeito

A decisão académica da matrícula de origem pode permanecer concluída enquanto a
dívida vencida bloqueia apenas a ativação da matrícula destino.
