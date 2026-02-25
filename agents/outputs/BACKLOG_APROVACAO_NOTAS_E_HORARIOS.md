# Backlog Executável — Aprovação de Notas, Fórmulas e Horários (KLASSE)

contexto: fechamento dos backlogs levantados na revisão do pipeline acadêmico.
status_run: atualizado com verificação no código/migrations existentes.

## Resumo executivo

- **Backlog de conflito estrutural de horário**: **fechado** (já existe no banco com `EXCLUDE USING gist`).
- **Backlog de fórmula oficial unificada**: **aberto (alto)**.
- **Backlog de unificação de engine de aprovação**: **aberto (alto)**.
- **Backlog de observabilidade operacional**: **aberto (médio)**.

---

## BKL-001 — Conflitos de horário no banco (hard guard)
- Prioridade: Alta
- Estado: ✅ Fechado
- Evidência de fechamento:
  - `ux_quadro_horarios_turma_slot` para evitar duplicação de slot por turma.
  - `quadro_horarios_professor_slot_excl` para evitar professor duplicado no mesmo slot.
  - `quadro_horarios_sala_slot_excl` para evitar sala duplicada no mesmo slot.
- Referência:
  - `supabase/migrations/20260309000000_scheduler_engine.sql`

Decisão:
- Mantido como implementado; não abrir fix adicional aqui.

---

## BKL-002 — Fórmula configurável aplicada end-to-end
- Prioridade: Alta
- Estado: 🔶 Aberto
- Problema:
  - `modelos_avaliacao.formula` existe no schema e API de gestão, mas não há evidência inequívoca de execução dessa fórmula na RPC de lançamento/fecho.
- Referências:
  - `supabase/migrations/20261121090000_modelos_avaliacao_formula_meta.sql`
  - `apps/web/src/app/api/escolas/[id]/modelos-avaliacao/route.ts`
  - `supabase/migrations/20261128061000_update_lancar_notas_batch_updated_at.sql`

Ação proposta:
1. Criar função SQL determinística `public.calcular_nota_componentes(...)` que interprete `formula` com whitelist de operadores.
2. Usar essa função em uma RPC única de fechamento/cálculo (fonte oficial).
3. Publicar testes de contrato por tipo (`trimestral`, `pap`, `estagio`, `isencao`, `final_unica`).

Critério de pronto:
- Mesma entrada gera mesma nota em API de pauta, boletim, transição e export oficial.

---

## BKL-003 — Unificar engines de aprovação (evitar dupla fonte de verdade)
- Prioridade: Alta
- Estado: 🔶 Aberto
- Problema:
  - Coexistem cálculo em rota (`professor/pauta`) e engines legadas (`grade-engine`, `transition-engine`).
- Referências:
  - `apps/web/src/app/api/professor/pauta/route.ts`
  - `apps/web/src/lib/pedagogico/grade-engine.ts`
  - `apps/web/src/lib/pedagogico/transition-engine.ts`

Ação proposta:
1. Definir **engine oficial única** (preferencialmente no banco, por consistência multi-canal).
2. Rebaixar engines legadas para adaptadores de leitura ou remover após migração.
3. Criar snapshot tests comparando resultados pré/pós unificação por turma real.

Critério de pronto:
- Um único caminho de cálculo para aprovação final institucional.

---

## BKL-004 — Observabilidade e performance operacional
- Prioridade: Média
- Estado: 🔶 Aberto
- Problema:
  - Falta telemetria explícita para acompanhar impacto de triggers/travas e constraints em picos.

Ação proposta:
1. Instrumentar métricas de falha por regra (`status_fecho`, `trava_notas_em`, conflitos de slot).
2. Dashboard técnico com taxa de bloqueio por escola/rota.
3. Alerta para regressão de latência em endpoints críticos (`/api/professor/notas`, `/api/escolas/[id]/horarios/*`).

Critério de pronto:
- SLO definido + alertas ativos + runbook de diagnóstico.

---

## Ordem de execução recomendada
1. BKL-002 (fórmula oficial)
2. BKL-003 (engine única)
3. BKL-004 (observabilidade)

