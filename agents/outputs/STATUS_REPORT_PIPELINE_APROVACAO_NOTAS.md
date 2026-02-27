# Status Report — Pipeline de Aprovação de Notas / Horários / Fórmulas (KLASSE)

run_scope: verificação (sem alterações de runtime)

## Resposta curta

**Parcialmente coberto.**

- ✅ Coberto: lançamento de notas centralizado em RPC + travas no banco para turma fechada e período travado.
- ✅ Coberto: detecção de conflitos de horário em fluxo manual e auto-geração.
- ✅ Coberto: há constraint estrutural no PostgreSQL (`EXCLUDE` por `professor_id+slot_id` e `sala_id+slot_id`) além das validações nas rotas.
- ✅ Ajuste recente: `modelos_avaliacao.formula` passou a ser a fonte principal dos componentes/pesos.
- ⚠️ Gap: coexistência de motores de cálculo pode gerar divergência de regra oficial (pauta vs engines legados).
- ✅ Ajuste recente: `pauta-grid` devolve `componentes_ativos` + `peso_por_tipo`, e a UI usa os pesos do backend para calcular MT.
- ✅ Ajuste recente (hardening estrutural): UI de presets passou a ler metadados do DB (`curriculum_presets` + `curriculum_preset_subjects`).
- ✅ Ajuste recente (hardening estrutural): `course_code` e intervalo de classes migrados para `curriculum_presets`.
- ✅ Ajuste recente (hardening estrutural): `pauta-geral` agora usa pesos do modelo oficial via `resolveModeloAvaliacao`.
- ✅ Ajuste recente (hardening estrutural): `pauta-anual` calcula aprovação com regras do modelo (`regras`).

---

## 1) Pipeline de Aprovação/Lançamento de Notas

### 1.1 Entradas e centralização
- `POST /api/professor/notas` e `POST /api/secretaria/notas` exigem idempotency key e chamam `lancar_notas_batch`.
- Isso reduz divergência entre portais e concentra regra de negócio no banco.

Evidências:
- `apps/web/src/app/api/professor/notas/route.ts`
- `apps/web/src/app/api/secretaria/notas/route.ts`

### 1.2 Regras na RPC
- RPC valida actor (professor atribuído ou admin), turma, turma_disciplina e período.
- Faz upsert atômico em `notas` e escreve `audit_logs`.

Evidência:
- `supabase/migrations/20261128061000_update_lancar_notas_batch_updated_at.sql`

### 1.3 Fechos/travas
- Trigger bloqueia `notas` e `avaliacoes` se `turmas.status_fecho != 'ABERTO'`.
- Trigger adicional bloqueia por `periodos_letivos.trava_notas_em < now()`.

Evidências:
- `supabase/migrations/20261128065000_add_turmas_status_fecho.sql`
- `supabase/migrations/20260203000009_rpc_fechar_periodo_unificado.sql`

Risco residual:
- Duas travas com semânticas diferentes podem gerar mensagens e troubleshooting inconsistentes.

---

## 2) Conflitos de Horário

### 2.1 Fluxo manual (`/horarios/quadro`)
- Bloqueia conflito de professor e sala no mesmo slot (`409`).
- Em modo `publish`, também valida cobertura de carga horária por disciplina.

Evidência:
- `apps/web/src/app/api/escolas/[id]/horarios/quadro/route.ts`

### 2.2 Fluxo automático (`/horarios/auto`)
- Scheduler evita colisões de turma/professor/sala por slot.
- Retorna unmet reasons (`SEM_SLOTS`, `PROF_TURNO`, etc.) com trace.

Evidência:
- `apps/web/src/app/api/escolas/[id]/horarios/auto/route.ts`

Risco residual:
- Há proteção estrutural, mas convém monitorar custo do `EXCLUDE USING gist` em alta volumetria e manter manutenção de índices.

---

## 3) Fórmulas de Notas

### 3.1 Capacidade de configuração
- `modelos_avaliacao` tem `tipo`, `regras`, `formula`.
- API de modelos persiste e retorna esses campos.

Evidências:
- `supabase/migrations/20261121090000_modelos_avaliacao_formula_meta.sql`
- `apps/web/src/app/api/escolas/[id]/modelos-avaliacao/route.ts`

### 3.2 Execução real da fórmula
- A resolução de modelo agora prioriza `modelos_avaliacao.formula.componentes` (fallback para `componentes`).
- Backfill preenche `formula` para modelos existentes.

Evidências:
- `supabase/migrations/20260311020000_modelos_avaliacao_formula_backfill.sql`
- `apps/web/src/lib/academico/avaliacao-utils.ts`

Risco residual:
- Possível divergência entre engines legadas e regra oficial se houver caminhos fora do modelo.

---

## 4) Fluxos e consistência de motor de cálculo

- Existem engines pedagógicos legados (`grade-engine`, `transition-engine`) com regra fixa.
- O sistema também tem cálculo em rotas API (pauta), criando risco de dupla fonte de verdade.

Evidências:
- `apps/web/src/lib/pedagogico/grade-engine.ts`
- `apps/web/src/lib/pedagogico/transition-engine.ts`
- `apps/web/src/app/api/professor/pauta/route.ts`

---

## Conclusão objetiva

**Não está “100% coberto” ainda.**

Estado atual é bom em segurança operacional (locks + permissões + auditoria), mas ainda precisa hardening para nível enterprise em:
1. **Unificação da fórmula oficial** (garantir execução única end-to-end);
2. **Reduzir drift entre engines legadas e cálculo em rotas**;
3. **Observabilidade/performance de constraints de horário** (telemetria de lock/latência).

---

## Backlog mapeado (próximos buracos)

### 🔴 Alto impacto
1. **Motor único de cálculo oficial**: eliminar divergência entre `grade-engine`/`transition-engine` e rotas de pauta.
2. **Contrato único de travas**: consolidar lógica de `turmas.status_fecho` + `periodos_letivos.trava_notas_em` com mensagens consistentes.

### 🟡 Médio impacto
1. **Observabilidade de conflitos de horário**: métricas para colisão por slot e latência dos `EXCLUDE USING gist`.
2. **Testes de contrato**: garantir regressões zero em locks de notas e publish.
