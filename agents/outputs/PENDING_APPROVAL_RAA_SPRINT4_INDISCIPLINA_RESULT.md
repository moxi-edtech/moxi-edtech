# Aprovação necessária — RAA Sprint 4 / Resultado por indisciplina

run_id: RAA-SPRINT4-INDISCIPLINA-RESULT-20260815
timestamp: 2026-08-15
estado: APPROVED — migration aplicada e validada em 2026-08-15

## Acção proposta

Integrar eventos ativos de indisciplina grave ao resolvedor público `resolve_estado_resultado`, produzindo o estado canónico `reprovado_por_indisciplina` quando existir ocorrência no mesmo ano letivo/matrícula com `impacta_resultado = true`.

O estado é distinto de `reprovado`: impede que a reapreciação académica seja aberta indevidamente e permite ao Portal do Aluno explicar “retido por indisciplina grave”.

## Diff

Migration proposta:

`supabase/migrations/20260815210000_raa_indisciplina_result_ssot.sql`

- renomeia a implementação atual para `resolve_estado_resultado_academico_base`;
- recria `resolve_estado_resultado` como wrapper público estável;
- preserva o resultado base para dados pendentes e exames ainda não resolvidos;
- aplica `reprovado_por_indisciplina` apenas a eventos ativos, no ano letivo da matrícula;
- expõe `indisciplina_eventos_ativos` para explicação e auditoria.

## Alterações de código realizadas após aprovação

- adicionado `reprovado_por_indisciplina` ao tipo e à política de elegibilidade RAA;
- reapreciação automática permanece impedida para este estado;
- painel de risco identifica “Retido por indisciplina grave”.

## Risco

É uma alteração de contrato SQL central. Um evento ativo passa a alterar o veredicto canónico, por isso a aplicação deve ser validada com amostras sem evento, com evento resolvido e com evento que não impacta o resultado.

## Como aprovar

Commit com mensagem: `APPROVE: RAA-SPRINT4-INDISCIPLINA-RESULT-20260815`

## Como rejeitar

Commit com mensagem: `REJECT: RAA-SPRINT4-INDISCIPLINA-RESULT-20260815 [motivo]`
