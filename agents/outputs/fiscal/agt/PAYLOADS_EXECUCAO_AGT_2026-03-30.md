# Playbook de Payloads — Execução AGT

Data: 2026-03-30  
Fonte: contrato real da API fiscal (`fiscal-documento.schema.ts` + `api/fiscal/documentos/route.ts`)

## Pré-requisitos

- Sessão autenticada no portal (cookie válido)
- Header obrigatório: `x-escola-id`
- Série ativa por tipo documental:
  - FT/FR para faturas
  - RC para recibos

## Variáveis base

```bash
BASE_URL="https://app.klasse.ao"
ESCOLA_ID="f406f5a7-a077-431c-b118-297224925726"
EMPRESA_ID="11a6aba6-3315-4732-a0b1-383202cf4f9d"
COOKIE="next-auth.session-token=..."
```

## P7 — Documento com desconto de linha e desconto global

Status atual: `EXECUTÁVEL PARCIAL`  
Motivo: `settlement_amount` por linha está suportado e serializado no builder; desconto global ainda depende de fechamento no motor para cobertura total AGT.

Payload técnico base (para emissão de 2 linhas com decimais):

```bash
curl -sS -X POST "$BASE_URL/api/fiscal/documentos" \
  -H "Cookie: $COOKIE" \
  -H "x-escola-id: $ESCOLA_ID" \
  -H "Content-Type: application/json" \
  --data-raw '{
    "empresa_id": "'"$EMPRESA_ID"'",
    "tipo_documento": "FT",
    "prefixo_serie": "FR",
    "origem_documento": "interno",
    "invoice_date": "2026-03-30",
    "moeda": "AOA",
    "cliente": { "nome": "Consumidor final" },
    "itens": [
      {
        "descricao": "Servico decimal linha 1",
        "product_code": "SERV_DECIMAL_01",
        "quantidade": 100,
        "preco_unit": 0.55,
        "settlement_amount": 4.84,
        "taxa_iva": 14
      },
      {
        "descricao": "Servico linha 2",
        "product_code": "SERV_DECIMAL_02",
        "quantidade": 1,
        "preco_unit": 10,
        "taxa_iva": 14
      }
    ]
  }'
```

Nota: para fechar AGT ponto 7, incluir também cenário de desconto global e validar reconciliação final do `SettlementAmount`.

## P8 — Documento em moeda estrangeira

Status atual: `EXECUTÁVEL`

```bash
curl -sS -X POST "$BASE_URL/api/fiscal/documentos" \
  -H "Cookie: $COOKIE" \
  -H "x-escola-id: $ESCOLA_ID" \
  -H "Content-Type: application/json" \
  --data-raw '{
    "empresa_id": "'"$EMPRESA_ID"'",
    "tipo_documento": "FT",
    "prefixo_serie": "FR",
    "origem_documento": "interno",
    "invoice_date": "2026-03-30",
    "moeda": "USD",
    "taxa_cambio_aoa": 925.1234,
    "cliente": { "nome": "Cliente USD", "nif": "5001234567" },
    "itens": [
      {
        "descricao": "Mensalidade em USD",
        "product_code": "SERV_USD_01",
        "quantidade": 1,
        "preco_unit": 100,
        "taxa_iva": 14
      }
    ]
  }'
```

Validação esperada: nó `<Currency>` presente no XML SAF-T.

## P9 — Cliente identificado sem NIF, total < 50 AOA, registro antes das 10h

Status atual: `EXECUTÁVEL` (com controle operacional de horário)

```bash
curl -sS -X POST "$BASE_URL/api/fiscal/documentos" \
  -H "Cookie: $COOKIE" \
  -H "x-escola-id: $ESCOLA_ID" \
  -H "Content-Type: application/json" \
  --data-raw '{
    "empresa_id": "'"$EMPRESA_ID"'",
    "tipo_documento": "FT",
    "prefixo_serie": "FR",
    "origem_documento": "interno",
    "invoice_date": "2026-03-30",
    "moeda": "AOA",
    "cliente": { "nome": "Cliente sem NIF AGT" },
    "itens": [
      {
        "descricao": "Servico de baixo valor",
        "product_code": "SERV_LOW_01",
        "quantidade": 1,
        "preco_unit": 40,
        "taxa_iva": 0,
        "tax_exemption_code": "M07",
        "tax_exemption_reason": "Isencao de IVA - servicos de educacao"
      }
    ]
  }'
```

Validação operacional:
- executar antes das 10h;
- capturar `SystemEntryDate` no retorno/ledger.

## P10 — Outro cliente identificado sem NIF

Status atual: `EXECUTÁVEL`

Repete P9 com outro cliente lógico (nome diferente) e total livre.

## P3/P4/P5/P11/P12/P13/P14/P15

Status atual: `PARCIALMENTE DESTRAVADO`  
Motivo técnico (estado do código):

- tipos aceitos no schema/API: `PP`, `GR/GT`, `FG`;
- builder SAF-T serializa `OrderReferences` quando há referência de origem;
- builder SAF-T serializa `SettlementAmount` por linha;
- `SelfBillingIndicator` fixo em `0`.

Conclusão:
- estes pontos exigem execução operacional guiada + evidência (e ajuste de auto-faturação para ponto 13) antes da geração definitiva do pacote AGT.
