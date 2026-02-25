# KLASSE — Big Tech Performance Standard (P0)

> **Versão:** 1.1  
> **Status:** NORMATIVO — não pode ser ignorado em nenhum PR de feature nova.  
> **Princípio:** O utilizador nunca deve sentir que o sistema está a pensar. Latência percebida ≤ 100ms em condições normais; nunca mais de 500ms visíveis.

---

## O que este documento é

Um contrato executável. Cada regra tem um critério de verificação. Se não é verificável, não é uma regra — é uma intenção.

---

## 3 Pilares

### Pilar A — Reads pré-calculados (zero COUNT/SUM ao vivo)

**Regra:** Nenhum dashboard, badge ou KPI pode executar agregação em tempo de request.

| Tipo de dado | Fonte obrigatória | Proibido |
|---|---|---|
| Dashboards e KPIs | MV ou tabela de agregados | `COUNT(*)`, `SUM()` ao vivo |
| Badges de contagem | MV de contagem com refresh | `count: "exact"` do Supabase |
| Listas paginadas | Tabela base com índices compostos | JOINs sem índice |
| Relatórios pesados | Snapshot + export assíncrono | Query síncrona > 1s |

**Regras operacionais para MVs:**
- Toda MV tem `UNIQUE INDEX` (obrigatório para `REFRESH CONCURRENTLY`).
- Toda MV tem wrapper `vw_*` — nunca aceder à MV directamente no código.
- Refresh por `escola_id` quando possível para limitar o impacto por tenant.
- Cron de refresh: 5–10 min em produção. Máximo tolerado: 15 min.
- Nomenclatura: `mv_<domínio>_<métrica>` (ex: `mv_financeiro_inadimplencia`).

**Critério de verificação — Pilar A:**
```sql
-- Nenhuma query de dashboard deve aparecer em EXPLAIN ANALYZE com Seq Scan em tabelas > 10k rows
EXPLAIN ANALYZE <query_do_dashboard>;
-- Esperado: Index Scan ou Bitmap Index Scan, nunca Seq Scan em tabelas críticas.

-- MV tem UNIQUE INDEX
SELECT indexname FROM pg_indexes WHERE tablename = 'mv_<nome>' AND indexdef LIKE '%UNIQUE%';
-- Esperado: pelo menos 1 resultado.
```

---

### Pilar B — Writes instantâneos (Optimistic UI + Outbox)

**Regra:** O utilizador recebe feedback visual em ≤ 50ms. O servidor pode demorar mais — o cliente não espera para confirmar.

**Fluxo obrigatório para mutações críticas:**
1. Cliente aplica a mudança localmente (optimistic update).
2. Request enviado com `Idempotency-Key: <uuid-gerado-no-cliente>`.
3. Se sucesso → confirma estado local.
4. Se falha de rede → entra no outbox (IndexedDB) com retry exponencial.
5. Se falha de negócio (ex: nota inválida) → reverte estado local + mostra erro.

**Mutações que exigem este padrão (P0):**
- Lançar frequência (presença/falta).
- Lançar nota.
- Registar pagamento.
- Fechar período (frequências/notas).
- Fecho de caixa.

**Mutações que não exigem outbox mas exigem idempotência no servidor:**
- Criar matrícula.
- Emitir documento.
- Gerar mensalidades.

**Regras do servidor para idempotência:**
```typescript
// Header obrigatório em todas as mutações críticas
const idempotencyKey = req.headers.get("Idempotency-Key")
if (!idempotencyKey) return 400 // rejeitar sem a chave

// Verificar se já processado
const existing = await supabase
  .from("idempotency_keys")
  .select("response_body, status_code")
  .eq("key", idempotencyKey)
  .eq("escola_id", escolaId)
  .maybeSingle()

if (existing.data) return Response.json(existing.data.response_body, { status: existing.data.status_code })

// Processar + guardar resultado
```

**Critério de verificação — Pilar B:**
- Enviar o mesmo request duas vezes com a mesma `Idempotency-Key` → segunda resposta idêntica à primeira, sem efeito duplicado no DB.
- Desligar a rede durante lançamento de nota → nota aparece no outbox → religar → nota sincronizada automaticamente.
- Feedback visual após clique ≤ 50ms (medível com `performance.now()` no `onClick`).

---

### Pilar C — Percepção (skeleton + streaming + cache correto)

**Regra:** O utilizador nunca vê uma página em branco ou um spinner global. O shell é sempre imediato.

**Hierarquia de carregamento obrigatória:**
1. Shell (sidebar, header, breadcrumb) → imediato, nunca aguarda dados.
2. Skeleton idêntico ao conteúdo real → aparece em ≤ 16ms (primeiro frame).
3. Dados reais → substituem o skeleton quando chegam.
4. Estados de erro → substituem o skeleton se a fetch falhar (nunca página em branco).

**Regras de cache por tipo de dado:**

| Dado | Directiva | Justificação |
|---|---|---|
| Dados financeiros | `cache: "no-store"` | Nunca pode estar desactualizado |
| Dados académicos (notas, frequência) | `cache: "no-store"` | Alterado frequentemente por professores |
| Listas de turmas/disciplinas | `revalidate: 60` | Muda raramente, edge cache aceitável |
| Configurações da escola | `revalidate: 300` | Muda muito raramente |
| Assets estáticos | `immutable` | Nunca muda |

**Proibido:**
- `force-cache` em qualquer página de trabalho operacional.
- Spinner global (`<Loader2 className="animate-spin" />` a nível de página inteira).
- Fetch waterfall: não esperar fetch A terminar para iniciar fetch B quando são independentes.

**Critério de verificação — Pilar C:**
- DevTools Network → throttle para "Fast 3G" → shell visível em < 100ms.
- Lighthouse Performance Score ≥ 80 nas rotas críticas.
- Nenhum `layout shift` (CLS) acima de 0.1 nas páginas de lista.

---

## 2 Hardenings

### Hardening 1 — Estados visuais de consistência (obrigatório em todas as mutações)

Todo elemento de UI que representa um dado que pode estar em trânsito deve ter 3 estados visuais explícitos:

| Estado | Visual | Quando |
|---|---|---|
| ✅ Sincronizado | Normal, sem indicador | Dado confirmado pelo servidor |
| 🟡 Pendente | Opacidade reduzida ou spinner inline | Em trânsito ou no outbox |
| 🔴 Falhou | Badge vermelho + acção disponível | Erro irrecuperável que precisa de atenção |

**Proibido:** estado mudo — quando algo falhou e o utilizador não sabe.

### Hardening 2 — SLAs por rota (mensuráveis, não aspiracionais)

| Rota | p50 | p95 | Método de medição |
|---|---|---|---|
| Dashboards (admin/secretaria) | < 100ms | < 200ms | Server timing header |
| Grids de lista (turmas, alunos) | < 150ms | < 300ms | Server timing header |
| Pauta (lançamento de notas) | < 200ms | < 400ms | Server timing header |
| Mutations críticas (nota, pagamento) | Feedback < 50ms | Confirmação < 500ms | `performance.now()` no cliente |
| Export/PDF | — | < 5s | Assíncrono via Inngest |
| MV refresh | — | < 2s | `pg_stat_user_tables` |

**Como medir em produção:**
```typescript
// Em cada route handler crítico
const start = Date.now()
// ... lógica ...
const duration = Date.now() - start
return NextResponse.json(data, {
  headers: { "Server-Timing": `db;dur=${duration}` }
})
```

---

## Regras operacionais (checklist de PR)

Antes de qualquer PR ser aprovado que toque em dashboards, listas ou mutações:

- [ ] Nenhum `COUNT(*)` / `SUM()` / `AVG()` em queries de dashboard.
- [ ] Nenhum `count: "exact"` do Supabase em produção.
- [ ] Toda MV nova tem `UNIQUE INDEX` + wrapper `vw_*` + cron de refresh.
- [ ] Toda mutação crítica tem `Idempotency-Key` + deduplicação no servidor.
- [ ] Nenhuma página de trabalho tem spinner global.
- [ ] Skeleton presente em todas as tabelas/grids.
- [ ] `force-cache` ausente em rotas operacionais.
- [ ] Server timing header presente em todos os endpoints críticos.

---

## Plano de execução

### Semana 1 — "Não trava"
**Dono:** eng. backend  
**Done when:** todas as queries de dashboard passam no EXPLAIN sem Seq Scan.

1. Auditar e criar MVs em falta + índices compostos por `escola_id`.
2. Remover `force-cache` e `count: "exact"` nas páginas críticas.
3. Adicionar server timing headers nas rotas de dashboard.

**Verificação:**
```sql
SELECT schemaname, matviewname, last_refresh
FROM pg_matviews
WHERE schemaname = 'public'
ORDER BY last_refresh DESC;
```

### Semana 2 — "Parece 0ms"
**Dono:** eng. frontend  
**Done when:** Lighthouse ≥ 80 nas rotas críticas; zero spinner global.

1. Skeletons reais em todas as tabelas grandes (pauta, lista de alunos, caixa).
2. `Suspense` + streaming nos portais principais.
3. TanStack Query nas grids com stale-while-revalidate.

### Semana 3 — "Não perde dado"
**Dono:** eng. fullstack  
**Done when:** teste de rede cortada durante lançamento de nota não perde o dado.

1. Outbox client com IndexedDB + retry exponencial com tecto (máx 30s).
2. Idempotency server: tabela `idempotency_keys` + deduplicação em todas as mutações P0.
3. Estados visuais ✅🟡🔴 em todas as mutações críticas.

### Semana 4 — "Observabilidade"
**Dono:** eng. devops / fullstack  
**Done when:** alerta dispara quando MV está stale > 15min.

1. Server timings por rota em produção + dashboard de p95.
2. Métricas de retry/outbox (quantos por hora, taxa de sucesso).
3. Alerta: `last_refresh` de MV crítica > 15 min → notificação no Slack/Discord.

---

## Critérios de aceite globais

Para o sistema ser considerado em conformidade com este padrão:

- [ ] `REFRESH CONCURRENTLY` em todas as MVs sem bloquear SELECTs simultâneos.
- [ ] Dashboards p95 < 200ms (verificado com server timing em produção).
- [ ] Feedback visual de mutation < 50ms (verificado com `performance.now()`).
- [ ] Zero duplicação em mutações críticas (verificado com teste de idempotência).
- [ ] MV mais crítica (`mv_financeiro_*` ou equivalente) com refresh < 10min em produção.
- [ ] Nenhuma rota de trabalho com spinner global (verificado em code review).

---

## O que NÃO está coberto aqui

Este documento cobre **reads e writes operacionais**. Não cobre:
- Geração de PDF/ZIP (coberto pelo contrato do Inngest/jobs).
- Performance de pesquisa global (coberto pelo contrato de Search).
- Autenticação e resolução de tenant (coberto pelo contrato de Segurança).

---

## Referências relacionadas
- `agents/contracts/AGENT_INSTRUCTIONS.md`
- `agents/contracts/FEATURES_PRIORITY.json`
- `agents/contracts/ROADMAP.md`
- `agents/contracts/KLASSE_ANALISE_COMPETITIVA_ANGOSCHOOL_2026-02-05.md`