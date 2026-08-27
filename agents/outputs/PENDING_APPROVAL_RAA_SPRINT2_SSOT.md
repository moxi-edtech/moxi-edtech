# Aprovação necessária — RAA Sprint 2 SSOT

run_id:    C6F42A10-RAA-RESULT-SSOT
timestamp: 2026-08-15

## Estado

**APPROVED — migration aplicada e validada em 2026-08-15.**

## Acção proposta

Criar o contrato SQL `resolve_estado_resultado(matricula_id, disciplina_id)` para centralizar escala, corte, estado e cor regulamentar do resultado. Para classes de exame sem MFD calculada, o contrato devolve `pendente_formula` e não promete aprovação/reprovação.

## Migration

`supabase/migrations/20260815170000_raa_result_status_ssot.sql`

## Risco

É uma alteração de contrato SQL consumível pelos portais. A função é não destrutiva, mas muda a superfície canónica de resultados e deve ser validada no Supabase antes de integrar cores e pautas.

## Como aprovar

Commit com mensagem: `APPROVE: C6F42A10-RAA-RESULT-SSOT`

## Como rejeitar

Commit com mensagem: `REJECT: C6F42A10-RAA-RESULT-SSOT [motivo]`
