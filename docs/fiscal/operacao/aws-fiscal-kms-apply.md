# AWS Fiscal KMS — Aplicação (Conta 009910375193)

Data: 2026-03-25
Role backend: `arn:aws:iam::009910375193:role/service-role/klasse-role-eumxo4d5`
Região sugerida da Lambda: `us-east-2`
Alias sugerido da chave: `alias/klasse-fiscal-signing`

## 1) IAM policy na role da Lambda

Crie o ficheiro `iam-kms-sign-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowFiscalKmsSign",
      "Effect": "Allow",
      "Action": [
        "kms:Sign",
        "kms:DescribeKey",
        "kms:GetPublicKey"
      ],
      "Resource": [
        "arn:aws:kms:us-east-2:009910375193:key/667d6033-1d19-4098-ade4-35633679c7f9"
      ]
    }
  ]
}
```

Aplicar:

```bash
aws iam put-role-policy \
  --role-name klasse-role-eumxo4d5 \
  --policy-name KlasseFiscalKmsSign \
  --policy-document file://iam-kms-sign-policy.json
```

## 2) Key policy da chave KMS

Descubra o Key ID do alias:

```bash
aws kms describe-key \
  --key-id arn:aws:kms:us-east-2:009910375193:alias/klasse-fiscal-signing \
  --region us-east-2 \
  --query 'KeyMetadata.KeyId' --output text
```

Faça backup da key policy atual:

```bash
aws kms get-key-policy \
  --key-id arn:aws:kms:us-east-2:009910375193:key/667d6033-1d19-4098-ade4-35633679c7f9 \
  --policy-name default \
  --region us-east-2 \
  --query Policy \
  --output text > key-policy-doc.json
```

Adicione na key policy o statement abaixo:

```json
{
  "Sid": "AllowKlasseLambdaRoleSign",
  "Effect": "Allow",
  "Principal": {
    "AWS": "arn:aws:iam::009910375193:role/service-role/klasse-role-eumxo4d5"
  },
  "Action": [
    "kms:Sign",
    "kms:DescribeKey",
    "kms:GetPublicKey"
  ],
  "Resource": "*"
}
```

Aplicar key policy atualizada:

```bash
aws kms put-key-policy \
  --key-id arn:aws:kms:us-east-2:009910375193:key/667d6033-1d19-4098-ade4-35633679c7f9 \
  --policy-name default \
  --policy file://key-policy-updated.json \
  --region us-east-2
```

## 3) Env da aplicação

```bash
AWS_REGION=us-east-2
AWS_KMS_KEY_ID=arn:aws:kms:us-east-2:009910375193:alias/klasse-fiscal-signing
```

## 4) SQL para private_key_ref (quando houver chaves ativas)

```sql
UPDATE public.fiscal_chaves
SET private_key_ref = 'kms://us-east-2/alias/klasse-fiscal-signing'
WHERE status = 'active'
  AND (private_key_ref IS NULL OR btrim(private_key_ref) = '');
```

## 5) Verificações

- Compliance probe: `GET /api/fiscal/compliance/status?probe=1`
- Emissão fiscal smoke test: `POST /api/fiscal/documentos`

## Evidência de execução (2026-03-25)

Timestamp (UTC): `2026-03-25T22:35:46Z`

- AWS Account: `009910375193`
- Lambda role alvo: `arn:aws:iam::009910375193:role/service-role/klasse-role-eumxo4d5`
- KMS KeyId: `667d6033-1d19-4098-ade4-35633679c7f9`
- KMS Key ARN: `arn:aws:kms:us-east-2:009910375193:key/667d6033-1d19-4098-ade4-35633679c7f9`
- Alias operacional: `alias/klasse-fiscal-signing`
- `private_key_ref` aplicado: `kms://us-east-2/alias/klasse-fiscal-signing`
- Fingerprint real aplicado: `sha256:67109718a05db343e329cd71171843d450eebad62f59583ef18d8b7b37fd5324`
- IAM inline policy aplicada na role `klasse-role-eumxo4d5`:
  - policy: `KlasseFiscalKmsSign`
  - actions: `kms:Sign`, `kms:DescribeKey`, `kms:GetPublicKey`
  - resource: `arn:aws:kms:us-east-2:009910375193:key/667d6033-1d19-4098-ade4-35633679c7f9`
- Key policy KMS aplicada com `Sid = AllowKlasseLambdaRoleSign` para:
  - principal: `arn:aws:iam::009910375193:role/service-role/klasse-role-eumxo4d5`
  - actions: `kms:Sign`, `kms:DescribeKey`, `kms:GetPublicKey`

Bootstrap fiscal aplicado no banco remoto:
- `empresa_id`: `da76e0cc-b1a0-410f-8502-49251e1bf5ea`
- `serie_id`: `7ab16f27-0d45-4bc8-812d-41e58db2fb99` (`FR/2026/interno`)
- `chave_id`: `5eb97fbd-7da8-46b6-96ab-fd4e44a0a141` (`key_version=1`, `status=active`)
- `escola_id` vinculada: `bb4b4278-3403-4f2f-8a73-dd4917fd1fde` (`Dias De Vida`)

## Estado actual (fecho infra)

- `IAM`: concluído e verificado.
- `KMS key policy`: concluído e verificado.
- `Probe/smoke da aplicação`: pendente de sessão autenticada no ambiente local (resposta atual via `curl`: `401 UNAUTHENTICATED` com cookie placeholder).
