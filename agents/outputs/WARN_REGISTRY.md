# WARNs operacionais activos — AppyPay

Pendências de validação; não são findings de violação sem evidência de código.

| WARN ID | Regra | Ficheiro | Ticket | Responsável | Prazo |
|---|---|---|---|---|---|
| APY-003 | Contrato de PASS: limites de prova | docs/financeiro/appypay.md | docs/financeiro/appypay.md#ativação-pendente | gundja | Antes da ativação |
| APY-004 | Contrato de PASS: cobertura integral | agents/outputs/PERFORMANCE_GATE.md | agents/outputs/PERFORMANCE_GATE.md#veredito | Engenharia | Antes do merge |
| APY-005 | Agent 3: estrutura financeira/RLS | docs/financeiro/appypay-portal-services.proposed.sql | agents/outputs/PENDING_APPROVAL.md | gundja | Antes da aplicação/publicação |
| APY-007 | Qualidade: lint existente | apps/web/src/app/api/aluno/financeiro/route.ts | docs/financeiro/appypay.md#portal-do-aluno--propinas-serviços-e-emolumentos-2026-10-29 | Engenharia | Antes do gate global |

## Resolvidos

APY-001: aprovação a1338163-1df9-4a14-9f79-ff677e5f3e84; SQL aplicado e verificado em 2026-10-28.

APY-002: em 2026-10-29, build completo Next.js com validação de tipos e 182 páginas aprovado. Lint separado e 19 testes aprovados. Sem alterações no lockfile. Não substitui o fluxo publicado com provedor.
