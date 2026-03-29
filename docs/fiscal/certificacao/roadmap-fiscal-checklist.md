# Roadmap Fiscal — Checklist

Data: 2026-03-19

## Fase 0 — Decisões de contrato
- [x] Contexto fiscal separado em `fiscal_*`.
- [x] Tenant fiscal definido como `empresa_id`.
- [x] Ponte escola → empresa via `fiscal_escola_bindings`.
- [x] RLS fiscal baseado em `fiscal_empresa_users`.
- [x] Contrato de séries, chaves e ledger imutável definido.

## Fase 1 — Foundation (dados e guardrails)
- [x] Tabelas fiscais criadas (`fiscal_empresas`, `fiscal_series`, `fiscal_documentos`, etc.).
- [x] Funções base (`current_tenant_empresa_id`, `user_has_role_in_empresa`, `fiscal_reservar_numero_serie`).
- [x] Triggers de consistência e imutabilidade.
- [x] RLS fiscal habilitada e policies criadas.
- [x] Índice semântico para séries activas.

## Fase 2 — Setup fiscal (API privada)
- [x] Endpoint de criação de empresa fiscal.
- [x] Endpoint de vínculo escola → empresa.
- [x] Endpoint de cadastro de série fiscal.
- [x] Endpoint de cadastro de chave pública + metadata.
- [x] Auditoria/log de setup fiscal.

## Fase 3 — Emissão fiscal (contratos + transação)
- [x] Serviço de canonical string.
- [x] Serviço de assinatura (RSA).
- [x] Emissão transaccional `POST /api/fiscal/documentos`.
- [x] Guarda de idempotência por `hash_control`.
- [x] Encadeamento de hash (`hash_anterior`).

### Requisitos de infraestrutura
- [x] Integração com AWS KMS (`AWS_REGION`, `AWS_KMS_KEY_ID`).
- [x] IAM role com permissão `kms:Sign` aplicada no backend.
- [x] Endpoint de readiness/probe para validar KMS/IAM (`GET /api/fiscal/compliance/status?probe=1`).

## Fase 4 — Operações fiscais
- [x] Rectificação e anulação por API.
- [x] Geração de eventos fiscais (ledger de eventos).
- [x] Exportação SAF-T(AO).
- [x] Validação automática SAF-T(AO) contra XSD com evidência de execução.
- [x] Indexação para consultas operacionais e auditoria.

## Fase 5 — Integração e UI
- [x] UI fiscal no portal financeiro.
- [x] Fluxo UI de retificação (`/financeiro/fiscal/retificar/[id]`).
- [x] Fluxos de aprovação e auditoria interna.
- [x] Alertas de falha/pendência fiscal.
- [x] Dashboards de compliance fiscal.

## Riscos pendentes
- [ ] Definição da estratégia de chave privada (KMS/HSM/secret manager).
- [ ] Processo de rotação de chaves e versionamento.
- [ ] Política de retenção e acesso ao ledger fiscal.

## Fase 6 — Infra e Governança (backlog actual)
- [x] Backlog de execução documentado (`docs/fiscal/certificacao/backlog-fiscal-fase6-infra-governanca.md`).
- [x] IAM role com `kms:Sign` aplicada em produção.
- [x] Regras AGT no PDF fiscal implementadas (menções obrigatórias + bloqueio de prévia sem assinatura).
- [ ] Validação de probe com sessão autenticada (`/api/fiscal/compliance/status?probe=1`).
- [ ] Política de rotação/versionamento de chaves publicada.
- [ ] Política de retenção e acesso ao ledger aprovada.

## Referências
- `docs/fiscal/api/fiscal-documentos.md`
- `docs/fiscal/api/fiscal-setup.md`
- `docs/fiscal/api/fiscal-saft.md`
- `docs/fiscal/certificacao/backlog-fiscal-fase6-infra-governanca.md`
- `agents/outputs/fiscal/RELATORIO_INVENTARIO_MODULO_FISCAL_2026-03-19.md`
- `agents/outputs/fiscal/KLASSE_FISCAL_PHASE0_PHASE1_2026-03-19.md`
