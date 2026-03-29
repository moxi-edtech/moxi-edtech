# Backlog Fiscal — Fase 6 (Infra & Governança)

Data: 2026-03-26
Status: Em execução

## Como ler este backlog

- `[x]` concluído com evidência técnica.
- `[ ]` pendente.

## Objetivo da Fase 6

Fechar pendências de infraestrutura KMS/IAM e governança operacional do ledger fiscal para suportar certificação AGT com operação estável.

## Critério de conclusão da fase

- Probe KMS/IAM autenticado com `probeStatus = ok`.
- Política de rotação/versionamento de chaves publicada e aprovada.
- Política de retenção/acesso ao ledger publicada e aprovada.
- Smoke test fiscal autenticado (emissão + compliance) executado com evidência.

## Infra KMS/IAM (P0)

- [x] IAM policy mínima de assinatura aplicada na role backend.
  Evidência: policy `KlasseFiscalKmsSign` na role `klasse-role-eumxo4d5` com `kms:Sign`, `kms:DescribeKey`, `kms:GetPublicKey`.

- [x] Key policy KMS ajustada para permitir assinatura pela role backend.
  Evidência: `Sid: AllowKlasseLambdaRoleSign` no `key_id 667d6033-1d19-4098-ade4-35633679c7f9`.

- [x] Chave/fingerprint fiscal operacionalizados.
  Evidência:
  `key_arn = arn:aws:kms:us-east-2:009910375193:key/667d6033-1d19-4098-ade4-35633679c7f9`
  `alias = alias/klasse-fiscal-signing`
  `fingerprint = sha256:67109718a05db343e329cd71171843d450eebad62f59583ef18d8b7b37fd5324`.

- [x] `private_key_ref` padronizado para KMS no fiscal.
  Evidência: `fiscal_chaves.private_key_ref = kms://us-east-2/alias/klasse-fiscal-signing`.

- [ ] Probe autenticado validado em runtime.
  Evidência esperada: resposta de `GET /api/fiscal/compliance/status?probe=1` com sessão real e `probeStatus = ok`.

## Operação e Governança (P1)

- [x] Política de rotação/versionamento de chaves publicada.
  Evidência: `docs/fiscal/politicas/politica-fiscal-rotacao-versionamento-chaves.md`.

- [x] Política de retenção e acesso ao ledger fiscal publicada.
  Evidência: `docs/fiscal/politicas/politica-fiscal-retencao-acesso-ledger.md`.

- [ ] Checklist operacional de auditoria revisado com Financeiro + Segurança.
  Evidência esperada: ticket/ata de aprovação.

## Validação funcional (P0)

- [ ] Smoke test autenticado de emissão fiscal (`POST /api/fiscal/documentos`) com sessão real.
  Evidência esperada: request/response final em ambiente alvo.

## Evidências técnicas já recolhidas

- Validação XSD automática integrada no fluxo SAF-T(AO).
  Evidência: `agents/outputs/fiscal/SAFT_XSD_VALIDATION_EVIDENCE_20260326T000801Z.md`.

- Dossiê fiscal consolidado para certificação.
  Evidência: `docs/fiscal/certificacao/fiscal-certificacao-dossie.md`.

- Bootstrap fiscal mínimo aplicado no remoto.
  Evidência: empresa/série/chave/membership/binding criados e ativos.

## Dependências

- Time de Infra/SecOps para aprovações e políticas IAM/KMS.
- Dono de negócio fiscal para política de retenção e governança do ledger.
