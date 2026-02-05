# Adherência — Entregas vs Prioridades (KLASSE)

Referências utilizadas:
- `agents/contracts/FEATURES_PRIORITY.json`
- `agents/outputs/SESSION_SUMMARY_FULL_ACADEMIC_CYCLE.md`
- `agents/outputs/SESSION_SUMMARY_ACADEMIC_CYCLE.md`
- `agents/outputs/ROADMAP_REAL_DATA_IMPLEMENTATION.md`
- `agents/outputs/PLAN_SECRETARIA_FINANCEIRO_HARMONY.md`

## Escopo da Checagem
- Portal Admin
- Ciclo Acadêmico (mínimo)
- Portal Secretaria
- Portal Financeiro

## Resultado Geral
- Score global: **64/100**
- Fortes: **Admin + Ciclo Acadêmico** (setup, publish, geração idempotente).
- Médios: **Financeiro** (SSOT + fecho cego com gaps de integração).
- Fracos: **Secretaria P0** (tenant hard, audit total, service-role ban).

### Método de score
- Peso por prioridade: P0=40, P1=30, P1.5=20, P2=10.
- Score do bloco = % de itens entregues dentro do bloco.
- Score global = média ponderada por portal.

---

## Portal Admin — Aderência

### P0 (Governança)
**Status:** Parcial
- Entregue: setup real com RPCs, status e impacto.
  - Evidência: `supabase/migrations/20260305000000_rpc_academic_setup_contracts.sql`
  - Evidência: `agents/outputs/ROADMAP_REAL_DATA_IMPLEMENTATION.md`
- Parcial: tenant isolation + RLS com cobertura total não evidenciada.
  - Evidência parcial: `supabase/migrations/20260202140000_add_cursos_rls.sql`
- Não evidenciado: gestão de staff/kill switch e branding documentos.

### P1 (Config Acadêmica)
**Status:** Alto
- Entregue: períodos letivos com validações P0.
  - Evidência: `supabase/migrations/20260305000000_rpc_academic_setup_contracts.sql`
- Entregue: currículo publish com validações P0.
  - Evidência: `supabase/migrations/20260305000022_update_curriculo_publish_contract.sql`
- Entregue: geração de turmas idempotente.
  - Evidência: `supabase/migrations/20260305000011_rpc_gerar_turmas_from_curriculo_idempotent.sql`

### Score Admin
- **72/100**

---

## Ciclo Acadêmico Mínimo — Aderência

### Setup do Ano
**Status:** Alto
- Entregue: ano letivo + períodos com travas.
  - Evidência: `supabase/migrations/20260305000010_add_academic_setup_columns.sql`
- Entregue: currículo publicado com bloqueio de edição.
  - Evidência: `supabase/migrations/20260305000022_update_curriculo_publish_contract.sql`
- Entregue: gerar turmas + vínculo disciplinas.
  - Evidência: `supabase/migrations/20260305000011_rpc_gerar_turmas_from_curriculo_idempotent.sql`

### Operação Trimestral
**Status:** Parcial
- Parcial: períodos ativos aplicados na secretaria.
  - Evidência: `agents/outputs/ROADMAP_REAL_DATA_IMPLEMENTATION.md`
- Não evidenciado: SSOT de frequência, notas completas e boletim com `missing_count`.

### Fechamento Anual
**Status:** Não evidenciado
- Não evidenciado: fechamento 3º trimestre, status final e histórico acadêmico.

### Score Ciclo Acadêmico
- **66/100**

---

## Portal Secretaria — Aderência

### P0 (Infra de guerra)
**Status:** Parcial
- Entregue: balcão com SSOT pagamentos e APIs reais.
  - Evidência: `agents/outputs/PLAN_SECRETARIA_FINANCEIRO_HARMONY.md`
- Parcial: audit trail no balcão, mas não em todas ações críticas.
  - Evidência: `agents/outputs/PLAN_SECRETARIA_FINANCEIRO_HARMONY.md`
- Não evidenciado: tenant hard isolation total + service-role ban.

### P1 (Operação diária)
**Status:** Parcial
- Entregue: fecho cego + fluxo de balcão.
  - Evidência: `agents/outputs/PLAN_SECRETARIA_FINANCEIRO_HARMONY.md`
- Não evidenciado: documentos oficiais, pendências, matrícula em lote, fila.

### P1.5 (Financeiro blindado)
**Status:** Médio
- Entregue: POS/registro pagamentos + conciliação básica.
  - Evidência: `agents/outputs/PLAN_SECRETARIA_FINANCEIRO_HARMONY.md`
- Parcial: recibo não negociável, estorno formal e parcial controlado.

### Score Secretaria
- **52/100**

---

## Portal Financeiro — Aderência

### P0/P1 (Core financeiro)
**Status:** Médio
- Entregue: SSOT `public.pagamentos`, fecho cego, conciliação e dashboards base.
  - Evidência: `agents/outputs/PLAN_SECRETARIA_FINANCEIRO_HARMONY.md`
- Parcial: extrato do aluno e relatórios ainda legados.
  - Evidência: `agents/outputs/PLAN_SECRETARIA_FINANCEIRO_HARMONY.md`
- Parcial: dashboards admin ainda usam views antigas.

### Score Financeiro
- **60/100**

---

## Backlog Geral (Consolidado)

### P0 — Bloqueadores
- Tenant hard isolation + RLS formal em todas queries/RPCs.
- Service-role ban nos endpoints humanos (documentado e enforce).
- Audit trail imutável em ações críticas (pagamento/estorno/matrícula/documentos).

### P1 — Operação diária
- Documentos oficiais com QR + numeração sequencial por escola.
- Mapa de pendências por aluno (docs/financeiro/histórico).
- Matrículas em lote com auditoria.
- Fila de atendimento com métricas.

### P1.5 — Financeiro blindado
- Recibo não negociável (PDF server-side com hash/QR).
- Estorno formal com motivo + usuário + timestamp.
- Pagamento parcial controlado + saldo auditável.
- Upload de comprovativo obrigatório (transfer/depósito) em todos fluxos.

### P2 — Robustez
- Idempotency keys em todas rotas sensíveis.
- Conciliação assistida com matching anti-duplicidade.
- Performance pass (p95 + paginação + anti N+1).
- Boletim bloqueado por inadimplência (configurável).

---

## Score Final
- **Global: 64/100**
- Admin: 72/100
- Ciclo Acadêmico: 66/100
- Secretaria: 52/100
- Financeiro: 60/100

## Próximos Passos Recomendados
- Formalizar tenant hard isolation e service-role ban em toda camada crítica.
- Fechar pacote de recibo/estorno/pagamento parcial com auditoria.
- Consolidar extrato do aluno e dashboards em cima do SSOT `public.pagamentos`.
