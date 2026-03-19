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

A rota foi criada em modo **guarded merge-ready**:

- valida o request;
- autentica o utilizador;
- verifica membership fiscal;
- confirma vínculo `escola -> empresa fiscal` quando existir contexto escolar;
- resolve semanticamente a série activa;
- verifica existência de chave fiscal activa;
- responde `501 FISCAL_EMISSAO_ATOMICA_PENDENTE` até existir uma RPC atómica de emissão.

## Porque a emissão está bloqueada

Emitir directamente pela route, sem uma RPC transaccional única, abre o risco de:

- reservar número e falhar antes de persistir o documento;
- criar buracos indevidos na sequência fiscal;
- quebrar o encadeamento entre reserva, assinatura e insert.

Em fiscal, isso é inaceitável.

## Respostas previstas

### 201 Created

Reservado para quando a RPC atómica existir.

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

### 501 FISCAL_EMISSAO_ATOMICA_PENDENTE

```json
{
  "ok": false,
  "error": {
    "code": "FISCAL_EMISSAO_ATOMICA_PENDENTE",
    "message": "A emissão fiscal permanece bloqueada até a introdução da RPC atómica que una reserva de número, assinatura e persistência sem risco de buracos na sequência."
  }
}
```

## Próximo passo obrigatório

Criar uma RPC/fluxo atómico de emissão fiscal que una, na mesma operação lógica:

1. reserva do número;
2. cálculo do encadeamento;
3. assinatura server-side/KMS;
4. insert de `fiscal_documentos`;
5. insert de `fiscal_documento_itens`;
6. insert de `fiscal_documentos_eventos`.
