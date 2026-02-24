# 🚀 ROADMAP CANÔNICO — KLASSE

> **Versão:** 1.2  
> **Princípio:** Nada entra sem performance aceitável, auditabilidade mínima e previsibilidade operacional.  
> **Referência de prioridades:** Ver `agents/specs/FEATURES_PRIORITY.json` para critérios de done por item.

---

## Como ler este roadmap

Cada fase tem:
- **Entrada:** o que tem de estar DONE para esta fase começar.
- **Itens:** referências directas ao `agents/specs/FEATURES_PRIORITY.json`.
- **Saída:** o que tem de estar DONE para esta fase terminar.
- **KPIs:** métricas mensuráveis que confirmam a saída.

Uma fase não começa se a anterior não satisfaz os critérios de saída. Sem excepção.

---

## FASE 0 — FUNDAÇÃO (V1.0)
**Objectivo:** Sistema seguro, auditável e que não perde dados. Nada de operacional antes disto.

**Critério de entrada:** repo criado, Supabase provisionado, ambiente de staging funcional.

**Itens (de `agents/specs/FEATURES_PRIORITY.json`):**
- `SHARED-P0.1` — Tenant hard isolation (escola_id NOT NULL + índices)
- `SHARED-P0.2` — RLS real por role
- `SHARED-P0.3` — Service Role banida de endpoints humanos
- `SHARED-P0.4` — Audit Trail imutável
- Performance base: MVs críticas criadas + REFRESH CONCURRENTLY + cron 5–10 min
- PWA Offline-First: service worker + estratégia de cache por rota

**Critérios de saída (todos obrigatórios):**
- [ ] `rg` em endpoints humanos retorna zero ocorrências de service_role.
- [ ] Teste HTTP confirma isolamento cross-tenant (utilizador escola A não lê escola B).
- [ ] pg_policies mostra policies activas em todas as tabelas críticas.
- [ ] Audit log regista escritas em matriculas, notas, pagamentos, frequencias.
- [ ] EXPLAIN ANALYZE sem Seq Scan em tabelas de dashboard.
- [ ] Lighthouse Performance ≥ 70 nas rotas críticas.

**KPIs de referência:**
- Zero vulnerabilidades cross-tenant em pentest manual.
- Zero duplicados criados em testes de idempotência.

---

## FASE 1 — VELOCIDADE E UX
**Objectivo:** Sensação de sistema instantâneo. Utilizador nunca espera para trabalhar.

**Critério de entrada:** Fase 0 com todos os critérios de saída satisfeitos.

**Itens:**
- `SEC-P0.1` — Search Global (Ctrl+K) com p95 ≤ 300ms
- `ADM-P0.1` — Setup Health Dashboard via MV
- `SEC-P2.3` — Performance Pass (sem N+1, sem Seq Scan)
- Skeletons reais em todas as tabelas de trabalho (alunos, pauta, caixa)
- TanStack Query nas grids com stale-while-revalidate
- `Suspense` + streaming nos portais principais
- F09 — Radar de Inadimplência via MV (sem COUNT ao vivo)
- F18 — Caixa/Propinas via MV

**Critérios de saída:**
- [ ] Search global p95 ≤ 300ms (server timing em staging).
- [ ] Dashboards p95 ≤ 200ms (server timing em staging).
- [ ] Nenhuma tabela de trabalho com spinner global (code review).
- [ ] Listagens p95 ≤ 500ms.
- [ ] Zero `count: "exact"` do Supabase em rotas de dashboard.

**KPIs:**
- Busca global p95 ≤ 300ms ✓
- Listagens p95 ≤ 500ms ✓
- Bundle inicial ≤ 250 KB gzipped ✓

---

## FASE 2 — CICLO ACADÉMICO COMPLETO
**Objectivo:** Escola consegue operar um ano lectivo inteiro sem suporte.

**Critério de entrada:** Fase 1 completa.

**Itens (admin/académico):**
- `ADM-P1.1` — Ano letivo activo + 3 trimestres configurados
- `ADM-P1.2` — Currículo versionado (draft/published/archived)
- `ADM-P1.3` — Preset + gerar turmas com turma_disciplinas
- `ADM-P1.4` — Setup Wizard (4 passos)
- `PROF-P2.5.1` — Diário de classe (frequência SSOT)
- `PROF-P2.5.2` — Lançamento de notas (sem placeholder)
- `PROF-P2.5.3` — Pauta e export
- `PROF-P2.5.4` — Trava por período

**Itens (secretaria operacional):**
- `SEC-P1.1` — Documentos oficiais (PDF + QR + numeração)
- `SEC-P1.2` — Mapa de pendências por aluno
- `SEC-P1.3` — Matrículas em lote

**Critérios de saída:**
- [ ] Uma escola consegue completar setup wizard end-to-end em < 30 min.
- [ ] Professor lança frequência e nota sem treino prévio.
- [ ] Secretaria emite declaração com timbre e QR válido.
- [ ] Trava de período bloqueia edição após data configurada.
- [ ] Boletim gerado com missing_count correcto.

**KPIs:**
- Acção financeira p95 ≤ 200ms ✓
- Zero dados perdidos em teste de rede instável com outbox ✓

---

## FASE 3 — CRESCIMENTO E DIFERENCIAÇÃO
**Objectivo:** Features que diferenciam comercialmente e reduzem churn.

**Critério de entrada:** Fase 2 completa com pelo menos 1 escola em piloto por 30 dias sem incidentes críticos.

**Itens:**
- `SEC-P1.5.1` / `SEC-P1.5.2` / `SEC-P1.5.3` / `SEC-P1.5.4` — Financeiro blindado completo
- `KF1` — Matrícula Sem Filas (fluxo guiado para encarregado)
- `KF3` — WhatsApp (notificações automáticas)
- `F12` — Recibos QR (verificação pública)
- `ALU-P1.1` / `ALU-P1.2` / `ALU-P1.3` — Portal do Aluno completo
- `SEC-P1.4` — Fila de Atendimento

**Critérios de saída:**
- [ ] Fecho de caixa cego funcional com diferença declarada vs sistema.
- [ ] Aluno consegue ver notas e extrato sem contactar secretaria.
- [ ] Recibo verificável via QR por qualquer pessoa.
- [ ] NPS de utilizadores de secretaria ≥ 7.

---

## FASE 4 — OBSERVABILIDADE E ESCALA
**Objectivo:** Sistema que avisa antes de ter problemas. Pronto para 50+ escolas.

**Critério de entrada:** Fase 3 completa, pelo menos 5 escolas activas.

**Itens:**
- Server timings por rota em produção + dashboard de p95 por rota
- Métricas de outbox: quantos itens por hora, taxa de sucesso, p95 de resolução
- Alerta: MV crítica stale > 15 min → notificação imediata
- `ADM-P2.1` — Audit Explorer
- `ADM-P2.2` — Importação controlada
- `SEC-P2.1` — Resiliência Unitel Proof completa
- `SEC-P2.2` — Conciliação bancária assistida
- Rate limiting por escola nos endpoints de geração de lote/PDF
- Cache de `resolveEscolaIdForUser` com TTL 5 min

**Critérios de saída:**
- [ ] Dashboard de p95 por rota visível em produção.
- [ ] Alerta de MV stale testado e funcional.
- [ ] 50 escolas simultâneas sem degradação de p95 acima dos SLAs.
- [ ] Teste de carga: 100 req/s em endpoint de lista sem erro 500.

---

## KPIs NÃO NEGOCIÁVEIS (válidos para todas as fases)

| Métrica | Target | Medição |
|---|---|---|
| Busca global p95 | ≤ 300ms | Server timing em produção |
| Listagens p95 | ≤ 500ms | Server timing em produção |
| Acção financeira p95 | ≤ 200ms | Server timing em produção |
| Bundle inicial | ≤ 250 KB gz | Lighthouse / next build |
| QR verify (edge) p95 | ≤ 200ms | Vercel Edge logs |
| Portal Aluno FCP em 3G | ≤ 3s | Lighthouse throttled |
| MV refresh | ≤ 10 min | pg_matviews.last_refresh |
| Uptime | ≥ 99.5% | Monitoring externo |

---

## Regras de excepção

**Um item pode entrar numa fase anterior se:**
1. Cliente de piloto bloqueia sem ele e não há alternativa operacional.
2. Aprovação explícita do product owner com justificação escrita.
3. O item tem critérios de done definidos antes de entrar (nunca "em construção").

**Um item nunca entra sem:**
- Performance aceitável (sem Seq Scan, sem N+1 conhecidos).
- Auditabilidade mínima (acção relevante registada em audit_log).
- Previsibilidade operacional (falha tem mensagem de erro clara, não 500 mudo).

---

## Referências

- `agents/specs/FEATURES_PRIORITY.json` — critérios de done por item
- `agents/ops/PILOT_CHECKLIST.md` — workflow de verificação e evidência
- `agents/specs/performance.md` — SLAs e regras de performance
