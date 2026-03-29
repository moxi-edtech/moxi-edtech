# Política Fiscal — Rotação e Versionamento de Chaves

Data: 2026-03-26
Status: Publicada (aguarda aprovação formal)
Escopo: Assinatura fiscal RSA (AWS KMS) no módulo fiscal KLASSE.

## Objetivo

Definir padrão único para criação, ativação, rotação, desativação e rollback de chaves de assinatura fiscal, com rastreabilidade por `key_version`.

## Princípios

- Chave privada nunca sai do KMS.
- Toda assinatura fiscal deve registrar `key_version`.
- Rotação sem downtime.
- Coexistência controlada de versões.
- Rollback explícito e auditável.

## Convenções obrigatórias

- `private_key_ref`: `kms://<region>/<key-id-or-alias>`
- Alias operacional: `alias/klasse-fiscal-signing`
- Algoritmo mínimo: RSA_2048 (`SIGN_VERIFY`)
- Campos de rastreio: `key_version`, `created_at`, `updated_at`, `status`

## Estados de chave

- `pending`: criada, ainda sem uso em emissão.
- `active`: usada para novas emissões.
- `retired`: não usada para novas emissões; mantida para verificação histórica.
- `revoked`: uso bloqueado por incidente/compliance.

## Política de rotação

- Frequência alvo: semestral ou imediata em incidente.
- Janela de transição: até 30 dias com coexistência entre versão ativa anterior e nova.
- Regra de emissão: apenas chave `active` assina novos documentos.
- Regra histórica: documentos antigos mantêm verificação pela versão original.

## Procedimento padrão (runbook resumido)

1. Criar nova chave KMS (`pending`) e coletar chave pública/fingerprint.
2. Aplicar IAM/key policy para role backend.
3. Registrar nova versão em `fiscal_chaves` com `status = pending`.
4. Validar probe e emissão controlada em ambiente alvo.
5. Promover para `active` e mover versão anterior para `retired`.
6. Registrar evidência técnica e aprovação interna.

## Rollback

Condições de rollback:
- falha de assinatura em produção;
- inconsistência de policy KMS/IAM;
- erro de verificação de assinatura.

Passos:
1. Reativar chave anterior (`retired -> active`).
2. Reverter referência operacional (`private_key_ref`) para versão anterior.
3. Bloquear nova versão (`active -> pending` ou `revoked` conforme incidente).
4. Registrar incidente e janela afetada.

## Controles mínimos de segurança

- Permissões mínimas: `kms:Sign`, `kms:DescribeKey`, `kms:GetPublicKey`.
- Proibido uso de credenciais service-role fora do backend fiscal autorizado.
- Logs obrigatórios de operação em auditoria fiscal.

## Evidências obrigatórias por rotação

- `aws kms describe-key` da versão nova.
- `aws iam get-role-policy` e `aws kms get-key-policy`.
- Resultado do probe: `GET /api/fiscal/compliance/status?probe=1`.
- Smoke de emissão fiscal autenticada.
- Registro de aprovação interna.

## Referências

- `docs/fiscal/operacao/aws-fiscal-kms-apply.md`
- `docs/fiscal/certificacao/backlog-fiscal-fase6-infra-governanca.md`
- `docs/fiscal/api/fiscal-documentos.md`
