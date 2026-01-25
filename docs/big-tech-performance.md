# KLASSE — Big Tech Performance Standard (P0)

## Objetivo
Perceived latency ~0ms com consistência eventual segura. Este padrão define o que é obrigatório para reads, writes, UX e SLAs de performance.

---

## 3 pilares

### Pilar A — Reads pré-calculados (zero COUNT/SUM ao vivo)
- Dashboards, badges e KPIs: somente MV ou tabela de agregados.
- Listas paginadas: tabela base com índices, sem agregação.
- Relatórios pesados: snapshot + export assíncrono quando escalar.

**Regra operacional**
- MV com `UNIQUE INDEX` (para `REFRESH CONCURRENTLY`).
- Refresh por `escola_id` quando possível.
- Wrapper `vw_*` obrigatório.
- Remover `count: "exact"` em produção — usar MV de contagem.

### Pilar B — Writes instantâneos (Optimistic UI + Outbox)
- UI confirma localmente primeiro.
- Request com `Idempotency-Key`.
- Falhas entram em fila (outbox) e reprocessam automaticamente.
- Servidor garante execução única por chave.

Aplicar primeiro:
- Lançar presença.
- Lançar nota.
- Fecho de caixa.
- Fechar período (frequências/notas).

### Pilar C — Percepção (skeleton + streaming + cache correto)
- Sem spinner global em páginas de trabalho.
- Shell sempre imediato (sidebar/header).
- Miolo com `Suspense` + skeleton idêntico à tabela.
- Dados críticos com `no-store`; `revalidate` apenas onde tolerável.

---

## 2 hardenings

### Hardening 1 — SLA de consistência visual
- ✅ Sincronizado.
- 🟡 Pendente (offline / retry).
- 🔴 Falhou (ação necessária).

### Hardening 2 — Contrato de performance por rota
- Dashboards: <200ms via MV.
- Grids/pauta: primeira render <300ms com skeleton imediato.
- Mutations: feedback visual <50ms + retry em background.
- DB: refresh de MV sem lock (`CONCURRENTLY`).

---

## Regras operacionais
1. Sem cálculo ao vivo em dashboard.
2. MV com `UNIQUE INDEX`, `REFRESH CONCURRENTLY`, `refresh_mv_*` e cron 5–10 min.
3. Outbox com idempotência obrigatória nas mutações críticas.
4. Cache crítico sempre `no-store`.

---

## Plano de execução

### Semana 1 — “Não trava”
1. MVs faltantes + índices + refresh concurrente.
2. Remover `force-cache` nas páginas críticas.
3. Trocar `count: "exact"` → MV de badges.

### Semana 2 — “Parece 0ms”
1. Skeletons reais nas tabelas grandes.
2. Suspense/streaming nos portais.
3. TanStack Query nas grids (pauta/caixa).

### Semana 3 — “Não perde dado”
1. Outbox client (IndexedDB) + retry/backoff.
2. Idempotency no server (header + dedupe).
3. Estados visuais ✅🟡🔴.

### Semana 4 — “Observabilidade”
1. Server timings por rota.
2. Métricas de retry/outbox.
3. Alertas: MV stale > X min.

---

## Critérios de aceite
- `REFRESH CONCURRENTLY` sem bloquear SELECT.
- Dashboards <200ms (MV).
- Feedback visual <50ms em mutations.
- Zero duplicação (idempotência).
