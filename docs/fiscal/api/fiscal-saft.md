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
- Regista auditoria de operação em `audit_logs` (`FISCAL_SAFT_EXPORTADO`).
- Valida o XML automaticamente contra XSD versionado (`xmllint --schema`).

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
    "xsd_validation": {
      "ok": true,
      "validator": "xmllint",
      "xsdVersion": "AO_SAFT_1.01"
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
- `400 FISCAL_SAFT_XSD_INVALID` (quando `xsd_version` não é suportado)
- `401 UNAUTHENTICATED`
- `403 FORBIDDEN`
- `403 FISCAL_ESCOLA_BINDING_NOT_FOUND`
- `404 FISCAL_EMPRESA_NOT_FOUND`
- `409 FISCAL_SAFT_EXPORT_ALREADY_EXISTS`
- `422 FISCAL_SAFT_XSD_INVALID` (XML inválido para o XSD)
- `503 FISCAL_SAFT_XSD_INVALID` (validador XSD indisponível no runtime)

## Evidência de validação XSD

Script para gerar evidência local em `agents/outputs/`:

```bash
scripts/fiscal-saft-xsd-evidence.sh /caminho/arquivo.xml AO_SAFT_1.01
```

Evidência já gerada nesta implementação:

- `agents/outputs/fiscal/SAFT_XSD_VALIDATION_EVIDENCE_20260326T000801Z.md`
