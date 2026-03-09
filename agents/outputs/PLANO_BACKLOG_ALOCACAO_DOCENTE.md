# Plano de Execução — Backlog de Alocação Docente

Data: 2026-03-09
Objetivo: tornar a tríade Professor × Disciplina × Turma segura, normalizada e auditável.

## Etapas acordadas

1) Auditoria de base (já executada)
- Validar constraints e políticas existentes em `turma_disciplinas`, `turma_disciplinas_professores`, `notas` e `quadro_horarios`.
- Identificar duplicidade de função `lancar_notas_batch` com versões divergentes.

2) Segurança do vínculo docente
- Migrar `turma_disciplinas_professores` para `UNIQUE (escola_id, turma_id, disciplina_id)`.
- Garantir inexistência de duplicidades antes da migração.

3) Notas (RLS + RPC)
- Remover escrita direta de `notas` para `professor` na RLS.
- Garantir que escrita docente ocorra apenas via RPC `lancar_notas_batch`.
- Atualizar a versão com `p_is_isento` para validar alocação docente.

4) Horários (guardrail final)
- Trigger em `quadro_horarios` exigindo alocação docente válida (junção ou campo direto, fase de transição).

5) Verificações pós-migração
- Confirmar que constraints foram aplicadas.
- Confirmar que RLS de `notas` bloqueia DML direto para professor.
- Confirmar que `lancar_notas_batch` valida alocação para ambas as assinaturas.

## Resultado esperado
- Fonte de verdade única e segura para alocação.
- RLS defensiva em `notas`.
- Horário bloqueia professor não alocado.
- Auditoria e políticas alinhadas ao modelo multi‑tenant.
