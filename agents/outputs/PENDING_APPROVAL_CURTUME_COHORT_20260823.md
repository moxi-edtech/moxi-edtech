# Aprovação necessária — Coorte Curtume de virada assistida

run_id: CURTUME-COHORT-20260823
timestamp: 2026-08-23T00:00:00-03:00

## Acção proposta

Aplicar `20270823220000_curtume_assisted_transition_cohort.sql`. A migration cria as tabelas `academic_transition_cohorts` e `academic_transition_cohort_members`, com RLS de leitura por escola. A decisão administrativa sem notas passa a ser permitida somente para uma matrícula incluída numa coorte ativa e não expirada.

## Risco

É uma alteração de schema e políticas RLS. A API e o Balcão dependem destas tabelas; a migration deve entrar antes do deploy do código correspondente.

## Como aprovar

Commit com mensagem: `APPROVE: CURTUME-COHORT-20260823`

## Como rejeitar

Commit com mensagem: `REJECT: CURTUME-COHORT-20260823 [motivo]`
