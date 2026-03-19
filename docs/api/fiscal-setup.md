# API — Fiscal / Setup privado

## Objetivo

Contrato interno para preparar o setup fiscal antes da emissão oficial.

## Endpoints

### POST /api/fiscal/setup/empresa

Cria uma empresa fiscal e regista o utilizador como `owner`.

```json
{
  "nome": "Empresa Fiscal X",
  "nif": "5000000000",
  "endereco": "Rua Exemplo, Luanda",
  "certificado_agt_numero": "AGT-2026-0001",
  "metadata": { "origem": "setup_privado" }
}
```

Requer Super Admin.

### POST /api/fiscal/setup/bindings

Vincula escola → empresa fiscal.

```json
{
  "empresa_id": "uuid",
  "escola_id": "uuid",
  "is_primary": true,
  "effective_from": "2026-03-19",
  "effective_to": null,
  "metadata": { "origem": "onboarding" }
}
```

### POST /api/fiscal/setup/series

Cria uma série fiscal activa.

```json
{
  "empresa_id": "uuid",
  "tipo_documento": "FT",
  "prefixo": "2026",
  "origem_documento": "interno",
  "ativa": true,
  "metadata": { "canal": "portal_financeiro" }
}
```

### POST /api/fiscal/setup/chaves

Regista a chave fiscal pública e metadata.

```json
{
  "empresa_id": "uuid",
  "key_version": 1,
  "public_key_pem": "-----BEGIN PUBLIC KEY-----...",
  "private_key_ref": "kms://fiscal/key/1",
  "key_fingerprint": "sha256:...",
  "status": "active",
  "metadata": { "origem": "kms" }
}
```

## Notas

- Todas as rotas são `no-store`.
- As políticas RLS continuam a ser a fonte de autoridade.
- A emissão fiscal continua bloqueada até existir RPC atómica.
