# Update Log — Status/Notas/Matrículas

## Resumo
- Canonização de status de matrícula para `ativo`.
- `lancar_notas_batch` agora usa `matriculas.ativo = true`.
- Endpoints de pauta/boletim padronizados via `ACTIVE_MATRICULA_STATUSES`.
- Teste SQL de regressão criado para validar inclusão de status legados.

## Mudanças aplicadas no DB remoto
- `canonicalize_matricula_status_text` atualizado (migração `20261215010000_canonicalize_matricula_status_ativo.sql`).
- Constraint `matriculas_numero_only_when_ativa` reescrito (migração `20261215011000_update_matriculas_numero_constraint.sql`).
- Matrículas existentes normalizadas para `status = 'ativo'` quando `numero_matricula` presente.

## Mudanças no código
- `supabase/migrations/20261128059000_update_lancar_notas_batch_remove_updated_at.sql` agora filtra `matriculas.ativo = true`.
- `apps/web/src/lib/matriculas/status.ts` criado como contrato canônico.
- Rotas de pautas/notas atualizadas para `ACTIVE_MATRICULA_STATUSES`.

## Teste SQL
- `supabase/ops/tests/regression_lancar_notas_active.sql`

