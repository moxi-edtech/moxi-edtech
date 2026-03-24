# API — Fiscal / SAF-T(AO)

## Endpoint

`POST /api/fiscal/saft/export`

## Objetivo

Gerar exportação SAF-T(AO) por período, persistir registo em `fiscal_saft_exports` e registrar trilho de auditoria por documento em `fiscal_documentos_eventos` com `SAFT_EXPORTADO`.

## Request

```json
{
  "empresa_id": "uuid",
  "periodo_inicio": "2026-03-01",
  "periodo_fim": "2026-03-31",
  "xsd_version": "AO_SAFT_1.01",
  "metadata": {
    "canal": "portal_financeiro"
  }
}
```

## Regras

- Requer utilizador autenticado com membership fiscal (`owner|admin|operator`) na empresa.
- Se existir contexto escolar, valida vínculo activo escola → empresa fiscal.
- Período máximo por exportação: 12 meses.
- A rota é `no-store`.

## Resposta de sucesso (201)

```json
{
  "ok": true,
  "data": {
    "exportacao": {
      "id": "uuid",
      "empresa_id": "uuid",
      "periodo_inicio": "2026-03-01",
      "periodo_fim": "2026-03-31",
      "arquivo_storage_path": "fiscal/saft/<empresa>/<periodo>.xml",
      "checksum_sha256": "hex",
      "xsd_version": "AO_SAFT_1.01",
      "status": "generated",
      "created_at": "ISO-8601"
    },
    "summary": {
      "totalDocumentos": 12,
      "totalItens": 38,
      "totalLiquidoAoa": 1000000,
      "totalImpostosAoa": 140000,
      "totalBrutoAoa": 1140000
    },
    "saft_xml": "<?xml version=\"1.0\" ...",
    "content_type": "application/xml"
  },
  "warnings": [],
  "request_id": "uuid"
}
```

## Erros esperados

- `400 INVALID_PAYLOAD`
- `401 UNAUTHENTICATED`
- `403 FORBIDDEN`
- `403 FISCAL_ESCOLA_BINDING_NOT_FOUND`
- `404 FISCAL_EMPRESA_NOT_FOUND`
- `409 FISCAL_SAFT_EXPORT_ALREADY_EXISTS`
