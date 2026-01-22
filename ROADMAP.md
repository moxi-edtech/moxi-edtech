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
- Bundle inicial ≤ 250 KB gz
- QR verify (edge) p95 ≤ 200 ms

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

## NOTA FINAL

Nada entra sem:
- Performance aceitável
- Auditabilidade mínima
- Previsibilidade operacional

## REFERÊNCIAS
- `docs/pedagogico-map.md`
- `docs/global-search-roadmap.md`

KLASSE não cresce em cima de gambiarra.
