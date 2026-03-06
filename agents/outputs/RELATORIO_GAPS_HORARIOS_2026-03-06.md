# RELATÓRIO — Gaps Restantes no Domínio de Horários (KLASSE)
Data: 2026-03-06
Escopo: `supabase/migrations`, `apps/web/src/app/api/**`

## Veredito Executivo
O domínio de horários melhorou com `quadro_horarios` + `horario_slots`, mas ainda existem gaps de coesão e invariantes de domínio que podem causar divergência entre agenda de professor, visão do aluno e publicação de quadro oficial.

---

## GAP-01 — Dupla fonte de verdade (legacy `rotinas` vs novo `quadro_horarios`)
**Diagnóstico atual**
- A agenda do professor já consome `quadro_horarios` + `horario_slots`.
- A dashboard do aluno já consome `quadro_horarios` (SSOT) para “próxima aula”.

**Evidência**
- `professor/agenda` lê `quadro_horarios`.
- `aluno/dashboard` lê `rotinas`.

**Risco de coesão**
- Mitigado após migração para SSOT no portal do aluno.

**Cura recomendada**
- Manter `quadro_horarios` como SSOT de leitura (professor e aluno).
- Tratar `rotinas` apenas como legado temporário com plano de depreciação.

---

## GAP-02 — `versao_id` sem isolamento por constraint (versionamento sem blindagem)
**Diagnóstico atual**
- A API trabalha com `versao_id` no payload de quadro.
- O schema atual já inclui `horario_versoes` e constraints por versão.

**Evidência**
- `quadro/route.ts` exige `versao_id`.
- Constraints no schema base não incluem `versao_id`.

**Risco de coesão**
- Mitigado com constraints versionadas e entidade `horario_versoes`.

**Cura recomendada**
- Garantir manutenção contínua do SSOT e constraints versionadas.

---

## GAP-03 — Publicação não atômica (delete + insert) suscetível a corrida
**Diagnóstico atual**
- O endpoint agora usa RPC transacional para delete+insert por versão.

**Evidência**
- Fluxo explícito de `delete` seguido de `insert` em `quadro/route.ts`.

**Risco de coesão**
- Mitigado com RPC `upsert_quadro_horarios_versao_atomic`.

**Cura recomendada**
- Manter publicação via RPC transacional com lock por turma/versão.

---

## GAP-04 — `horario_slots` sem invariantes temporais fortes
**Diagnóstico atual**
- Existe check de `dia_semana`.
- Não há check explícito `inicio < fim` nem unicidade por (`escola_id`,`turno_id`,`dia_semana`,`ordem`) no artefato identificado.

**Evidência**
- Migração de scheduler define apenas `horario_slots_dia_semana_check`.

**Risco de coesão**
- Slots inválidos/sobrepostos podem degradar algoritmo automático e publicação manual.

**Cura recomendada**
- Adicionar checks e unicidade de ordem por dia/turno.
- Opcional: exclusão temporal (gist) para impedir sobreposição.

---

## GAP-05 — Algoritmo automático ignora indisponibilidade formal do professor
**Diagnóstico atual**
- Existe tabela `professor_disponibilidade` no schema.
- O auto-scheduler utiliza `teachers.turnos_disponiveis`, mas não cruza com `professor_disponibilidade` por dia/faixa.

**Evidência**
- `horarios/auto` consulta `teachers.turnos_disponiveis`.
- Não há consulta a `professor_disponibilidade` no fluxo de alocação.

**Risco de coesão**
- Grade “válida” tecnicamente pode violar indisponibilidades reais.

**Cura recomendada**
- Incorporar indisponibilidade como hard constraint no `pickSlot`.

---

## GAP-06 — Cálculo de “próxima aula” do aluno com semântica frágil
**Diagnóstico atual**
- Usa heurística por `Date.getDay()` e `weekday >= hoje` sobre `rotinas`.
- Não considera versão publicada de `quadro_horarios` nem horário atual do slot.

**Evidência**
- `aluno/dashboard` usa `rotinas` com `weekday`.

**Risco de coesão**
- “Próxima aula” pode ficar errada perto da virada do dia/semana.

**Cura recomendada**
- Migrar para leitura de `quadro_horarios + horario_slots` publicado e cálculo por timestamp.

---

## GAP-07 — Ausência de vínculo curricular forte no item de quadro
**Diagnóstico atual**
- `quadro_horarios` guarda `disciplina_id` direto.
- Regras de carga em publish usam `turma_disciplinas`/`curso_matriz` separadamente.

**Risco de coesão**
- Menor rastreabilidade curricular do slot para o contrato letivo da turma.

**Cura recomendada**
- Avaliar chave para `turma_disciplina_id` no quadro (ou constraint de coerência disciplina↔turma).

---

## GAP-08 — Falta de trilha de auditoria explícita para operações de horários
**Diagnóstico atual**
- Não há registro explícito de auditoria no endpoint de gravação/publicação de quadro.

**Risco de coesão**
- Dificulta reconstrução legal/operacional de “quem publicou que versão e quando”.

**Cura recomendada**
- Registrar eventos de `DRAFT_SAVE`, `PUBLISH`, `UNPUBLISH`, `DELETE_VERSION` com hash do payload.

---

## Priorização recomendada (impacto x urgência)
1. GAP-01, GAP-02, GAP-03 (críticos para consistência funcional e concorrência).
2. GAP-04, GAP-05, GAP-06 (consistência operacional diária).
3. GAP-07, GAP-08 (governança e robustez de domínio).

## Estado final
- **GAP-01/02/03 mitigados** com SSOT, versionamento e atomicidade.
- Permanecem GAP-04 a GAP-08 para próximos sprints.
