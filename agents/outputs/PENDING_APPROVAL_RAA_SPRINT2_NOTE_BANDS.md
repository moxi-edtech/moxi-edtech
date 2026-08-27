# Aprovação necessária — Agent 3
run_id:    RAA-SPRINT2-NOTE-BANDS-20260815
timestamp: 2026-08-15T00:00:00-03:00

## Acção proposta

Aplicar `supabase/migrations/20260816012000_raa_decreto_note_bands.sql` na Escola KLASSE para corrigir o resolvedor jurídico SQL e bloquear notas fora das faixas legais do Decreto Executivo 04/2026.

## Diff

```text
O corpo atual de public.resolve_raa_decreto_for_matricula(uuid, uuid)
é lido com pg_get_functiondef e recriado com a condição adicional:

7.ª, 8.ª, 10.ª, 11.ª e EJA 1.º ano: negativa abaixo de 7 bloqueia;
9.ª, 12.ª e EJA 2.º ano: negativa abaixo de 6 bloqueia;
6.ª e EJA Módulo 3: negativa abaixo de 3 bloqueia.
```

Diff completo: `supabase/migrations/20260816012000_raa_decreto_note_bands.sql`.

## Risco

A alteração torna o bloqueio jurídico mais restritivo. Pode converter uma decisão anteriormente elegível em retenção quando existir nota fora da faixa legal. É reversível por `git revert` e deve ser validada com matrículas de teste.

## Como aprovar

Commit com mensagem: `APPROVE: RAA-SPRINT2-NOTE-BANDS-20260815`

## Como rejeitar

Commit com mensagem: `REJECT: RAA-SPRINT2-NOTE-BANDS-20260815 [motivo]`
