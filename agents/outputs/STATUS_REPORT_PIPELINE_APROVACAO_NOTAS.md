# Status Report — Pipeline de Aprovação de Notas / Horários / Fórmulas (KLASSE)

run_scope: verificação (sem alterações de runtime)

## Resposta curta

**Parcialmente coberto.**

- ✅ Coberto: lançamento de notas centralizado em RPC + travas no banco para turma fechada e período travado.
- ✅ Coberto: detecção de conflitos de horário em fluxo manual e auto-geração.
- ✅ Coberto: há constraint estrutural no PostgreSQL (`EXCLUDE` por `professor_id+slot_id` e `sala_id+slot_id`) além das validações nas rotas.
- ⚠️ Gap: `modelos_avaliacao.formula` existe no schema/CRUD, mas não está claramente executada no pipeline de lançamento.
- ⚠️ Gap: coexistência de motores de cálculo pode gerar divergência de regra oficial (pauta vs engines legados).

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
- A RPC de lançamento cria/atualiza avaliações e notas, mas não mostra execução explícita de `formula` JSON.
- `professor/pauta` usa pesos/componentes para cálculo (ponderado), porém isso não prova engine única para aprovação final institucional.

Evidências:
- `supabase/migrations/20261128061000_update_lancar_notas_batch_updated_at.sql`
- `apps/web/src/app/api/professor/pauta/route.ts`

Risco residual:
- Possível divergência entre “fórmula configurada” e “fórmula efetivamente aplicada” em todos os fluxos.

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
