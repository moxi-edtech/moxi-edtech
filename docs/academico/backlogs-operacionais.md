Data: 2026-03-03

## P0 — Operação e confiabilidade

1. **Runbook executável + guardrails de sequência no fechamento**
   - Pré-condições, rollback operacional, janela de manutenção, ownership por etapa.

2. **SLO/SLA e alertas para jobs críticos**
   - `fechamento_academico_jobs` e `pautas_lote_jobs`.
   - Definir thresholds (ex: 30/60 min) e alertas para stuck jobs.

## P1 — Escala e UX operacional

3. **Painel único de operações académicas** — **ENTREGUE (v1)**
- Consolida fechamento acadêmico + lotes oficiais.
 - Filtros por período/status/tipo.
   - Exportação CSV/JSON.

4. **Reprocessamento seletivo assistido por causa raiz**
   - Recipes por classe de erro (dados faltantes, lock, permissões, storage).

5. **Padronização jurídica/branding dos PDFs**
   - Assinatura, vocabulário, metadados e versionamento documental.

## P2 — Governança e auditoria avançada

6. **Métricas históricas de ciclo académico**
   - Lead time por etapa, taxa de falha por turma, reincidência por tipo de erro.

7. **Política formal de reabertura de snapshot legal**
   - Quem aprova, quando, evidências e SLA de reabertura.

8. **Contratos públicos de API legada em sunset**
   - Cronograma de descontinuação + telemetria de consumo.

