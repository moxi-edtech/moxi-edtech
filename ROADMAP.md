# 🚀 ROADMAP CANÔNICO — KLASSE

## PRIORIDADE 0 — FUNDAÇÃO (V1.0)

- GF1 — PWA Offline-First
- GF4 — Audit Trail Forense
- Base de Performance (DB + Front)

🎯 Objetivo: sistema rápido, confiável e auditável.

---

## PRIORIDADE 1 — VELOCIDADE & UX

- KF2 — Pesquisa Global (validar e manter)
- F09 — Radar de Inadimplência (MV)
- F18 — Caixa/Propinas (MV)
- Listagens rápidas e previsíveis

🎯 Objetivo: sensação de sistema instantâneo.

---

## PRIORIDADE 2 — CRESCIMENTO

- KF1 — Matrícula Sem Filas
- KF3 — WhatsApp
- F12 — Recibos QR

🎯 Objetivo: diferenciação comercial.

---

## KPIs NÃO NEGOCIÁVEIS

- Busca global p95 ≤ 300 ms
- Listagens p95 ≤ 500 ms
- Ação financeira p95 ≤ 200 ms
- Dashboards p95 ≤ 200 ms (via MV)
- Grids/pauta: primeira render p95 ≤ 300 ms (skeleton imediato)
- Mutations: feedback visual ≤ 50 ms
- Bundle inicial ≤ 250 KB gz
- QR verify (edge) p95 ≤ 200 ms

---

## METAS P95 POR TIPO DE TELA

- Dashboards: p95 ≤ 200 ms (via `vw_*`/`mv_*`).
- Listagens críticas: p95 ≤ 500 ms (cursor + `limit <= 30`).
- Detalhes críticos: p95 ≤ 400 ms (cache `no-store`).
- Busca global: p95 ≤ 300 ms (debounce 250–400 ms).
- Grids/pauta: primeira render p95 ≤ 300 ms (skeleton imediato).
- Mutations: feedback visual ≤ 50 ms (retry em background).

---

## PRINCÍPIOS OPERACIONAIS (HARD GATE)

1) Latência é requisito funcional (p95 por tela; regressão = bloqueio)
2) Derivados > dados brutos (dashboards só via MV/derivados)
3) Gates duplos (UX + backend) para features premium
4) Fail fast, fail quiet (timeouts claros + fallback visual)
5) One way to do things (um padrão de MV, audit, search, virtualização)
6) Infra que protege o humano (flags, kill-switch, wrappers, audit)
7) Context over cleverness (SQL explícito, front previsível, pouca mágica)

---

## SESSÃO ATUAL — EVIDÊNCIAS

- **Evolução do Portal de Admissão (KF1):**
  - Implementação do **"Cofre do Candidato"** com Timer de Reserva de 48h.
  - Fluxo de **Auto-serviço para Pendências** (Re-upload de documentos rejeitados via RPC segura).
  - Integração de dados bancários da escola diretamente na tela de checkout pública.
  - API de Radar atualizada com KPIs de Gargalo de Conversão (Expirando, Re-enviados).
  - Dashboards via `vw_admissoes_counts_por_status` sincronizados com o banco.
- Paginação/cursor em listagens críticas (Secretaria/Admin/Radar):
  - `apps/web/src/components/secretaria/TurmasListClient.tsx`
  - `apps/web/src/app/escola/[id]/admin/alunos/page.tsx`
  - `apps/web/src/components/secretaria/AdmissoesInboxClient.tsx`
- APIs com `limit + cursor + next_cursor`:
  - `apps/web/src/app/api/secretaria/admissoes/radar/route.ts` (Atualizada para suportar gargalos)

## PRÓXIMOS PASSOS

- **Integração de Notificações Automáticas:** Disparar WhatsApp/SMS ao transicionar para `pendente` ou `aguardando_pagamento`.
- **Refatoração da Lógica de Capacidade:** Incluir candidatos com reserva ativa no cálculo de "Últimas Vagas".
- **Draft Recovery Público:** Permitir que candidatos recuperem rascunhos de inscrição via telefone/email.
- Instrumentar p95 por tela (RUM) e bloquear regressões.

## NOTA FINAL

Nada entra sem:
- Performance aceitável
- Auditabilidade mínima
- Previsibilidade operacional

## REFERÊNCIAS
- `docs/pedagogico-map.md`
- `docs/global-search-roadmap.md`
- `agents/specs/performance.md`

KLASSE não cresce em cima de gambiarra.
