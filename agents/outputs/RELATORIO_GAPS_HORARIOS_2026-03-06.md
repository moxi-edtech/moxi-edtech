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
- As constraints temporais foram reforçadas com checks e exclusão por sobreposição.

**Evidência**
- Migração `20261216030000_horario_slots_temporal_guardrails.sql` adiciona `inicio < fim`, unicidade por dia/turno/ordem e exclusão de sobreposição.

**Risco de coesão**
- Mitigado com guardrails temporais e saneamento de slots existentes.

**Cura recomendada**
- Manter o saneamento e os checks como parte do pipeline de migrações.

---

## GAP-05 — Algoritmo automático ignora indisponibilidade formal do professor
**Diagnóstico atual**
- Existe tabela `professor_disponibilidade` no schema e agora é consumida pelo auto-scheduler.
- O algoritmo cruza dia/faixa e trata `indisponivel` como hard constraint.

**Evidência**
- `horarios/auto` consulta `professor_disponibilidade` e aplica bloqueio/penalidade na seleção de slot.

**Risco de coesão**
- Mitigado: slots conflitando com indisponibilidade são ignorados.

**Cura recomendada**
- Manter atualização de disponibilidade e revisar penalidade de `evitar` conforme feedback da escola.

---

## GAP-06 — Cálculo de “próxima aula” do aluno com semântica frágil
**Diagnóstico atual**
- A API do aluno consulta apenas `quadro_horarios` publicado e usa hora do slot.

**Evidência**
- `aluno/dashboard` usa `quadro_horarios + horario_slots` com cálculo por timestamp.

**Risco de coesão**
- Mitigado com cálculo por horário real e validação de intervalos.

**Cura recomendada**
- Manter consulta à versão publicada e validar slots com `inicio < fim`.

---

## GAP-07 — Ausência de vínculo curricular forte no item de quadro
**Diagnóstico atual**
- `quadro_horarios` guarda `disciplina_id` direto, mas agora valida contra `turma_disciplinas` + `curso_matriz`.

**Risco de coesão**
- Mitigado com trigger de coerência curricular no insert/update do quadro.

**Cura recomendada**
- Manter trigger de coerência disciplina↔turma e avaliar extensão futura para `turma_disciplina_id`.

---

## GAP-08 — Falta de trilha de auditoria explícita para operações de horários
**Diagnóstico atual**
- Auditoria adicionada com eventos de draft/publish registrados em tabela própria.

**Risco de coesão**
- Mitigado com tabela `horario_eventos` e payload com hash do quadro.

**Cura recomendada**
- Manter logging de `DRAFT_SAVE` e `PUBLISH`; adicionar `UNPUBLISH` e `DELETE_VERSION` quando as rotas forem criadas.

---

## Priorização recomendada (impacto x urgência)
1. GAP-01, GAP-02, GAP-03 (críticos para consistência funcional e concorrência).
2. GAP-04, GAP-05, GAP-06 (consistência operacional diária).
3. GAP-07, GAP-08 (governança e robustez de domínio).

## Estado final
- **GAP-01/02/03 mitigados** com SSOT, versionamento e atomicidade.
- **GAP-04/05/06 mitigados** com guardrails temporais, disponibilidade de professor e próxima aula por slots.
- **GAP-07/08 mitigados** com coerência curricular e trilha de auditoria.
