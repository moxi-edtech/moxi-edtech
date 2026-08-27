# Aprovação necessária — Agent 3
run_id:    RAA-SPRINT2-PENDING-303726FB
timestamp: 2026-08-15T00:00:00-03:00

## Acção proposta

Aplicar `supabase/migrations/20260816011000_raa_decreto_pending_without_policy.sql` na Escola KLASSE para transformar ausência de política/factos académicos num estado `pendente` acionável, sem erro 500.

## Diff

```text
CREATE OR REPLACE FUNCTION public.resolve_raa_progression_for_matricula(uuid, uuid)
  consulta o resolvedor jurídico;
  usa o contrato genérico quando possível;
  captura apenas RAA_PROGRESSION_POLICY_NOT_CONFIGURED;
  devolve decision=pendente e proximo_passo acionável;
  preserva outros erros para não ocultar falhas reais.
```

Diff completo: `supabase/migrations/20260816011000_raa_decreto_pending_without_policy.sql`.

## Risco

Operações sem política configurada deixarão de retornar erro 500 e passarão a bloquear de forma explícita. Outros erros continuam sendo lançados.

## Como aprovar

Commit com mensagem: `APPROVE: RAA-SPRINT2-PENDING-303726FB`

## Como rejeitar

Commit com mensagem: `REJECT: RAA-SPRINT2-PENDING-303726FB [motivo]`
