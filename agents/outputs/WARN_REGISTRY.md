# WARNs operacionais activos — AppyPay

Pendências de validação; não são findings de violação sem evidência de código.

| WARN ID | Regra | Ficheiro | Ticket | Responsável | Prazo |
|---|---|---|---|---|---|
| APY-003 | Contrato de PASS: limites de prova | docs/financeiro/appypay.md | docs/financeiro/appypay.md#ativação-pendente | gundja | Antes da ativação |
| APY-004 | Contrato de PASS: cobertura integral | agents/outputs/PERFORMANCE_GATE.md | agents/outputs/PERFORMANCE_GATE.md#veredito | Engenharia | Antes de liberar o processamento |
| APY-007 | Qualidade: lint existente | apps/web/src/app/api/aluno/financeiro/route.ts | docs/financeiro/appypay.md#portal-do-aluno--propinas-serviços-e-emolumentos-2026-10-29 | Engenharia | Antes do gate global |
| APY-008 | Verificação de integração | docs/financeiro/appypay-release-hardening.md | docs/financeiro/appypay-release-hardening.md#webhook | Engenharia / fornecedor | Antes da ativação |
| APY-009 | Funcionalidade protegida | apps/web/src/app/api/escolas/[id]/turmas/[turmaId]/delete/route.ts | docs/financeiro/appypay-release-hardening.md#legado | Engenharia | Antes de reabrir exclusão |

## Resolvidos

APY-001: aprovação a1338163-1df9-4a14-9f79-ff677e5f3e84; SQL aplicado e verificado em 2026-10-28.

APY-002: em 2026-10-29, build completo Next.js com validação de tipos e 182 páginas aprovado. Lint separado e 19 testes aprovados. Sem alterações no lockfile. Não substitui o fluxo publicado com provedor.

APY-005 resolvido em 2026-10-29: aprovação cf8dc48d-6b39-47d3-af87-410afcf95ddb, commit 5914e1c46, migration 20261029121743 aplicada e verificada. APY-004 agora inclui o bloqueio global confirmado em REPORT_SCAN.md, além dos candidatos ainda não certificados.


APY-004: três findings confirmados corrigidos nesta branch; demais candidatos e matriz MV ainda sem certificação. A proposta de exceção foi recusada. APY-008: confirmar classificação Transacional do webhook legado e payload real; lista geral omite o webhook que existe na aplicação. APY-009: exclusão de turmas desativada com 409 até operação atómica que proteja todas as dependências; FKs CASCADE tornam insuficiente conferir apenas matrículas/disciplinas/secções.
