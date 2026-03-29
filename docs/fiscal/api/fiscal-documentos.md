# API — Fiscal / Documentos

## Endpoints

`POST /api/fiscal/documentos`
`POST /api/fiscal/documentos/{documentoId}/rectificar`
`POST /api/fiscal/documentos/{documentoId}/anular`
`POST /api/fiscal/documentos/{documentoId}/submeter`
`GET /api/fiscal/documentos/{documentoId}/pdf`
`POST /api/fiscal/saft/export`
`GET /api/fiscal/compliance/status`

## Objetivo

Operar emissão e ciclo de vida fiscal no padrão híbrido do KLASSE:

- contrato público semântico na API;
- resolução interna de `serie_id`;
- guarda de acesso fiscal por `empresa_id`;
- transições formais de status fiscal (`emitido -> rectificado|anulado`) com trilho de eventos.

## Contrato público

### Request (legado)

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

### Request (canónico UI)

```json
{
  "ano_fiscal": 2026,
  "tipo_documento": "FT",
  "cliente_nome": "Consumidor Final",
  "itens": [
    {
      "descricao": "Mensalidade Março",
      "valor": 25000
    }
  ]
}
```

### Regras

- `origem_documento` é opcional no cliente, mas no backend assume `interno` por default.
- A API nunca expõe `serie_id` como argumento público.
- A API aceita dois formatos de payload em `POST /api/fiscal/documentos`:
  - formato legado completo (`empresa_id`, `prefixo_serie`, `cliente`, `invoice_date`, etc.);
  - formato canónico UI (`ano_fiscal`, `tipo_documento`, `cliente_nome`, `itens[{descricao,valor}]`).
- No formato canónico UI, o backend normaliza internamente para o contrato fiscal completo e resolve `empresa_id` pelo contexto do utilizador.
- A lookup semântica usa:
  - `empresa_id`
  - `tipo_documento`
  - `prefixo_serie`
  - `origem_documento`
- A rota é sempre `no-store`.

## Estado actual

As rotas operam em modo **atómico**:

- valida o request;
- autentica o utilizador;
- verifica membership fiscal;
- confirma vínculo `escola -> empresa fiscal` quando existir contexto escolar;
- resolve semanticamente a série activa;
- delega a emissão para a RPC transaccional `fiscal_emitir_documento`.
- rectificação via RPC `fiscal_rectificar_documento`;
- anulação via RPC `fiscal_anular_documento`;
- submissão para aprovação/auditoria interna via evento `SUBMETIDO`;
- registo de eventos fiscais no ledger (`RECTIFICADO` e `ANULADO`).
- auditoria de operações fiscais em `audit_logs`:
  - `FISCAL_DOCUMENTO_EMITIDO`
  - `FISCAL_DOCUMENTO_RECTIFICADO`
  - `FISCAL_DOCUMENTO_ANULADO`
  - `FISCAL_DOCUMENTO_SUBMETIDO`
  - `FISCAL_SAFT_EXPORTADO`

## Notas de assinatura

- `canonical_string` é gerada no backend para garantir determinismo.
- `hash_control` é calculado via SHA256 da canonical string.
- Assinatura RSA é feita via AWS KMS no backend.
- A assinatura prioriza `fiscal_chaves.private_key_ref` (por `empresa_id` + `key_version`) e usa `AWS_KMS_KEY_ID` como fallback.

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

### 409 FISCAL_PREVIEW_NOT_ALLOWED (PDF)

```json
{
  "ok": false,
  "error": {
    "code": "FISCAL_PREVIEW_NOT_ALLOWED",
    "message": "Documento ainda não assinado. Impressão/preview fiscal não permitido."
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

### 409 FISCAL_STATE_CONFLICT

```json
{
  "ok": false,
  "error": {
    "code": "FISCAL_STATE_CONFLICT",
    "message": "A transição de estado fiscal não é permitida para o documento."
  }
}
```

## Estado de integração SAF-T(AO)

- Exportação operacional disponível em `POST /api/fiscal/saft/export`.
- Registo de export em `fiscal_saft_exports`.
- Trilha de auditoria de export por documento em `fiscal_documentos_eventos` (`SAFT_EXPORTADO`).

## Estado de compliance operacional

- Dashboard fiscal disponível em `/financeiro/fiscal`.
- Probe de infraestrutura KMS/IAM disponível em `GET /api/fiscal/compliance/status?probe=1`.
- Sem bloqueio de plano nas operações fiscais; o controle é por autenticação + acesso fiscal à empresa.
- UI de retificação operacional em `/financeiro/fiscal/retificar/[id]`.
- PDF fiscal disponível em `GET /api/fiscal/documentos/{documentoId}/pdf` com:
  - 4 caracteres da assinatura no output;
  - menção “Processado por programa validado n.º.../AGT”;
  - menção “Este documento não serve de factura” para documentos fora de `FT/FR`;
  - bloqueio de preview para documentos em `pendente_assinatura`.

## Smoke tests executados (remoto)

> Todos os testes foram executados com `ROLLBACK`.

- Emissão fiscal com assinatura fornecida (`status = emitido`).
- Emissão fiscal sem assinatura, seguida de `fiscal_finalizar_assinatura`.

## Validação operacional (2026-03-25)

Resultado dos testes manuais via `curl` no ambiente local:

- `GET /api/fiscal/compliance/status?probe=1`:
  - resposta: `401 UNAUTHENTICATED`
  - causa: sessão não autenticada no `curl` (cookie placeholder)
- `POST /api/fiscal/documentos`:
  - payload inicial inválido corrigido para o schema atual:
    - usa `prefixo_serie` (não `serie_id`)
    - usa `invoice_date` obrigatório
    - usa `itens[].preco_unit` e `itens[].taxa_iva`
  - após correção do payload, resposta atual: `401 UNAUTHENTICATED`
  - causa: sessão não autenticada no `curl` (cookie placeholder)

Conclusão:
- Infra KMS/IAM está aplicada e documentada.
- Fecho funcional da API depende apenas de repetir os dois testes com cookie/token real de sessão.
