# Sessão — Resumo de Implementação e Backlogs (Billing Super Admin / Escola)

Data: 2026-03-01
Escopo: verificação do estado de implementação do painel de cobrança (Super Admin e Escola), confirmação de entregas e identificação de pendências.

## O que foi feito nesta sessão

### 1) Histórico no painel de cobranças (Super Admin)
- A aba **Histórico de Receitas** deixou de ser placeholder e passou a renderizar `BillingAuditHistoryTab`.
- O componente carrega os últimos eventos de billing a partir de `audit_logs` com ações de assinatura/comprovativo.

### 2) Fluxo de comprovativos (backend)
- O endpoint de assinatura suporta ações semânticas para comprovativos:
  - `confirm_receipt`
  - `reject_receipt`
- O fluxo atualiza status de pagamento e status de assinatura de forma consistente.

### 3) Auditoria forte (before/after)
- As alterações de assinatura e comprovativos registram trilha com:
  - `before`
  - `after`
  - `changed_fields`
  - `diff`
  - `actor_id`
  - `timestamp`

### 4) Hardening no bootstrap/sync de assinaturas
- O sync passou a criar assinaturas em **status `pendente`**.
- Inclusa validação para bloquear criação quando `valor_kz` é inválido.
- Incluídos campos de origem (`origem_registo`, `motivo_origem`) e relatório de revisão para Super Admin.

### 5) Painel da escola — ações de assinatura
- Foram adicionadas ações explícitas no cliente:
  - **Fazer upgrade**
  - **Mudar para anual**
  - **Gerir cartão (Stripe)**
  - **Ver histórico completo**
- A API de upgrade aplica guardrails:
  - só em ciclo ativo
  - sem downgrade no meio do ciclo

## Backlogs identificados

### B1 — Rejeição rápida na fila principal (UI)
- Na lista principal de cobranças, ainda não há botão de **Rejeitar** lado a lado com **Activar**.
- Hoje a ação rápida exposta é confirmação; rejeição existe no backend, mas não está fechada no fluxo rápido da grelha.

### B2 — KPIs financeiros consolidados de topo
- Ainda há KPI local com rótulo **MRR Estático** e cálculos no cliente.
- Falta consolidar métricas em endpoint dedicado (ex.: MRR, ARR, pendentes de comprovativo, vencidas > 7 dias).

### B3 — Histórico com filtros e export
- O histórico atual mostra eventos recentes, mas ainda sem:
  - filtros de período/escola/status
  - exportação (CSV/XLS)
  - visão mais analítica para conciliação

### B4 — Upgrade com checkout externo real (se requisito de negócio)
- A API de upgrade atualmente atualiza assinatura internamente com regras de negócio.
- Se o requisito for redirecionar para checkout transacional externo, falta esse acoplamento.

## Prioridade sugerida

1. **P1**: B1 (rejeição rápida na fila) + B2 (KPIs consolidados)
2. **P2**: B3 (filtros e export no histórico)
3. **P3**: B4 (checkout externo), condicionado ao modelo operacional desejado

## Conclusão

A sessão confirmou evolução significativa no núcleo de billing (histórico, auditoria, hardening e ações no portal da escola). O sistema está mais robusto para operação diária, mas ainda há pendências relevantes para fechar experiência operacional de alto volume e visão executiva de indicadores.
