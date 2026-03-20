# API — Fiscal / Documentos

## Endpoint

`POST /api/fiscal/documentos`

## Objetivo

Preparar a emissão fiscal no padrão híbrido do KLASSE:

- contrato público semântico na API;
- resolução interna de `serie_id`;
- guarda de acesso fiscal por `empresa_id`;
- bloqueio explícito da emissão até existir uma RPC atómica que evite buracos na sequência.

## Contrato público

### Request

```json
{
  "empresa_id": "uuid",
  "tipo_documento": "FR",
  "prefixo_serie": "2026",
  "origem_documento": "interno",
  "cliente": {
    "id": "uuid-opcional",
    "nome": "Empresa X",
    "nif": "5000000000"
  },
  "documento_origem_id": null,
  "rectifica_documento_id": null,
  "invoice_date": "2026-03-19",
  "moeda": "AOA",
  "taxa_cambio_aoa": null,
  "itens": [
    {
      "descricao": "Mensalidade Março",
      "quantidade": 1,
      "preco_unit": 25000,
      "taxa_iva": 14
    }
  ],
  "metadata": {
    "canal": "portal_financeiro"
  }
}
```

### Regras

- `origem_documento` é opcional no cliente, mas no backend assume `interno` por default.
- A API nunca expõe `serie_id` como argumento público.
- A lookup semântica usa:
  - `empresa_id`
  - `tipo_documento`
  - `prefixo_serie`
  - `origem_documento`
- A rota é sempre `no-store`.

## Estado actual

A rota opera em modo **atómico**:

- valida o request;
- autentica o utilizador;
- verifica membership fiscal;
- confirma vínculo `escola -> empresa fiscal` quando existir contexto escolar;
- resolve semanticamente a série activa;
- delega a emissão para a RPC transaccional `fiscal_emitir_documento`.

## Notas de assinatura

- `canonical_string` é gerada no backend para garantir determinismo.
- `hash_control` é calculado via SHA256 da canonical string.
- Assinatura RSA é feita via AWS KMS no backend.

## Respostas previstas

### 201 Created

```json
{
  "ok": true,
  "data": {
    "ok": true,
    "documento_id": "uuid",
    "numero": 42,
    "numero_formatado": "2026-000042",
    "hash_control": "...",
    "key_version": 1
  },
  "request_id": "uuid"
}
```

### 400 INVALID_PAYLOAD

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_PAYLOAD",
    "message": "O corpo da requisição é inválido."
  }
}
```

### 401 UNAUTHENTICATED

```json
{
  "ok": false,
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "Utilizador não autenticado."
  }
}
```

### 403 FORBIDDEN

```json
{
  "ok": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Sem acesso fiscal à empresa informada."
  }
}
```

### 404 SERIE_NAO_ENCONTRADA

```json
{
  "ok": false,
  "error": {
    "code": "SERIE_NAO_ENCONTRADA",
    "message": "Nenhuma série activa encontrada para a combinação semântica informada."
  }
}
```

### 409 SERIE_AMBIGUA

```json
{
  "ok": false,
  "error": {
    "code": "SERIE_AMBIGUA",
    "message": "Mais de uma série activa corresponde ao contrato semântico informado."
  }
}
```

### 409 CHAVE_FISCAL_INDISPONIVEL

```json
{
  "ok": false,
  "error": {
    "code": "CHAVE_FISCAL_INDISPONIVEL",
    "message": "A empresa não possui chave fiscal activa para emissão."
  }
}
```

## Próximo passo obrigatório

Integrar assinatura RSA real (KMS/HSM) e idempotência por `hash_control`.

## Smoke tests executados (remoto)

> Todos os testes foram executados com `ROLLBACK`.

- Emissão fiscal com assinatura fornecida (`status = emitido`).
- Emissão fiscal sem assinatura, seguida de `fiscal_finalizar_assinatura`.
