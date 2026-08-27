# Aprovação necessária — Agent 3
run_id:    CURTUME-ORIGEM-ANTES-DIVIDA-20260823
timestamp: 2026-08-23T00:00:00-03:00

## Acção proposta

Aplicar a migration `20270823210000_allow_closed_origin_rematricula_activation.sql` no PostgreSQL remoto. Ela substitui a implementação da RPC `finalizar_rematricula_balcao` sem alterar a assinatura, permitindo que uma matrícula de origem já concluída com resultado em `historico_anos` seja usada para ativar a matrícula destino depois da quitação.

## Diff

```diff
+ supabase/migrations/20270823210000_allow_closed_origin_rematricula_activation.sql
+ CREATE OR REPLACE FUNCTION public.finalizar_rematricula_balcao(...)
+   aceita origem com status `concluido`/`concluida`;
+   usa `historico_anos.resultado_final` (`aprovado`/`reprovado`) antes da decisão RAA;
+   preserva `status = concluido` e `ativo = false` na origem;
+   mantém o bloqueio financeiro da ativação da matrícula destino;
+ REVOKE ALL ... FROM PUBLIC;
+ GRANT EXECUTE ... TO authenticated, service_role;
```

Diff SQL completo: `supabase/migrations/20270823210000_allow_closed_origin_rematricula_activation.sql`.

## Risco

Uma RPC central de ativação de rematrícula será alterada; erro na compatibilidade pode impedir a ativação de destinos até reversão da migration.

## Como aprovar

Commit com mensagem: `APPROVE: CURTUME-ORIGEM-ANTES-DIVIDA-20260823`

## Como rejeitar

Commit com mensagem: `REJECT: CURTUME-ORIGEM-ANTES-DIVIDA-20260823 [motivo]`
