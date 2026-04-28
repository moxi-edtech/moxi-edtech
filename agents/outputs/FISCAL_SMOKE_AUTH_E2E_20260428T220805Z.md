# Fiscal Smoke Auth E2E

timestamp_utc: 20260428T220805Z
base_url: https://app.klasse.ao
escola_id: f406f5a7-a077-431c-b118-297224925726
empresa_id: 11a6aba6-3315-4732-a0b1-383202cf4f9d
ft_prefixo_serie: FR
rc_prefixo_serie: RC

## 1) Compliance Probe
```bash
curl -sS -X GET 'https://app.klasse.ao/api/fiscal/compliance/status?probe=1' -H 'Authorization: Bearer ***' -H 'x-escola-id: f406f5a7-a077-431c-b118-297224925726'
```
status_http: 401
```http
HTTP/2 401 
cache-control: public, max-age=0, must-revalidate
content-type: application/json
date: Tue, 28 Apr 2026 22:08:07 GMT
server: Vercel
strict-transport-security: max-age=63072000
vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch
x-matched-path: /api/fiscal/compliance/status
x-vercel-cache: BYPASS
x-vercel-id: gru1::iad1::574nf-1777414087591-db2a8729c6cb

```
```json
{"ok":false,"error":{"code":"UNAUTHENTICATED","message":"Utilizador não autenticado.","details":{"request_id":"75a095cf-df28-4821-8529-3608c2060542"}}}
```

## 2) Emissão FT padrão (AOA, ProductNumberCode fallback)
```bash
curl -sS -X POST 'https://app.klasse.ao/api/fiscal/documentos' -H 'Authorization: Bearer ***' -H 'x-escola-id: f406f5a7-a077-431c-b118-297224925726' -H 'Content-Type: application/json' --data-raw '{"empresa_id":"11a6aba6-3315-4732-a0b1-383202cf4f9d","tipo_documento":"FT","prefixo_serie":"FR","origem_documento":"interno","invoice_date":"2026-04-28","moeda":"AOA","cliente":{"nome":"Consumidor final"},"itens":[{"descricao":"Mensalidade - Smoke FT","product_code":"SERV_MENSALIDADE","quantidade":1,"preco_unit":15000,"taxa_iva":14}]}'
```
status_http: 401
```http
HTTP/2 401 
cache-control: public, max-age=0, must-revalidate
content-type: application/json
date: Tue, 28 Apr 2026 22:08:07 GMT
server: Vercel
strict-transport-security: max-age=63072000
vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch
x-matched-path: /api/fiscal/documentos
x-vercel-cache: MISS
x-vercel-id: gru1::iad1::khctt-1777414087879-6e8153314e1d

```
```json
{"ok":false,"error":{"code":"UNAUTHENTICATED","message":"Utilizador não autenticado.","details":{"request_id":"d8bb745f-b2d6-4674-8533-aaa80fddd8dc"}}}
```

## 3) Emissão FT isenta (IVA=0 com TaxExemption*)
```bash
curl -sS -X POST 'https://app.klasse.ao/api/fiscal/documentos' -H 'Authorization: Bearer ***' -H 'x-escola-id: f406f5a7-a077-431c-b118-297224925726' -H 'Content-Type: application/json' --data-raw '{"empresa_id":"11a6aba6-3315-4732-a0b1-383202cf4f9d","tipo_documento":"FT","prefixo_serie":"FR","origem_documento":"interno","invoice_date":"2026-04-28","moeda":"AOA","cliente":{"nome":"Pai sem NIF"},"itens":[{"descricao":"Propina Isenta","product_code":"SERV_PROPINA_ISENTA","quantidade":1,"preco_unit":10000,"taxa_iva":0,"tax_exemption_code":"M07","tax_exemption_reason":"Isencao de IVA - servicos de educacao"}]}'
```
status_http: 401
```http
HTTP/2 401 
cache-control: public, max-age=0, must-revalidate
content-type: application/json
date: Tue, 28 Apr 2026 22:08:08 GMT
server: Vercel
strict-transport-security: max-age=63072000
vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch
x-matched-path: /api/fiscal/documentos
x-vercel-cache: MISS
x-vercel-id: gru1::iad1::h7fw9-1777414088149-cf68e9c68531

```
```json
{"ok":false,"error":{"code":"UNAUTHENTICATED","message":"Utilizador não autenticado.","details":{"request_id":"5277f8bc-9536-45fa-be21-bf7e65a7ab7e"}}}
```

## 4) Emissão RC com PaymentMechanism
```bash
curl -sS -X POST 'https://app.klasse.ao/api/fiscal/documentos' -H 'Authorization: Bearer ***' -H 'x-escola-id: f406f5a7-a077-431c-b118-297224925726' -H 'Content-Type: application/json' --data-raw '{"empresa_id":"11a6aba6-3315-4732-a0b1-383202cf4f9d","tipo_documento":"RC","prefixo_serie":"RC","origem_documento":"interno","invoice_date":"2026-04-28","moeda":"AOA","payment_mechanism":"TB","cliente":{"nome":"Consumidor final"},"itens":[{"descricao":"Recebimento de mensalidade","product_code":"SERV_RECEB_MENSAL","quantidade":1,"preco_unit":5000,"taxa_iva":14}]}'
```
status_http: 401
```http
HTTP/2 401 
cache-control: public, max-age=0, must-revalidate
content-type: application/json
date: Tue, 28 Apr 2026 22:08:08 GMT
server: Vercel
strict-transport-security: max-age=63072000
vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch
x-matched-path: /api/fiscal/documentos
x-vercel-cache: MISS
x-vercel-id: gru1::iad1::d89d4-1777414088392-75d002e3f43d

```
```json
{"ok":false,"error":{"code":"UNAUTHENTICATED","message":"Utilizador não autenticado.","details":{"request_id":"c1465cde-1aa9-4a65-82a1-22ae63049c3f"}}}
```

## 5) Emissão FT em moeda estrangeira (USD)
```bash
curl -sS -X POST 'https://app.klasse.ao/api/fiscal/documentos' -H 'Authorization: Bearer ***' -H 'x-escola-id: f406f5a7-a077-431c-b118-297224925726' -H 'Content-Type: application/json' --data-raw '{"empresa_id":"11a6aba6-3315-4732-a0b1-383202cf4f9d","tipo_documento":"FT","prefixo_serie":"FR","origem_documento":"interno","invoice_date":"2026-04-28","moeda":"USD","taxa_cambio_aoa":920,"cliente":{"nome":"Cliente USD","nif":"999999999"},"itens":[{"descricao":"Servico em moeda externa","product_code":"SERV_USD","product_number_code":"SERV_USD","quantidade":1,"preco_unit":50,"taxa_iva":14}]}'
```
status_http: 401
```http
HTTP/2 401 
cache-control: public, max-age=0, must-revalidate
content-type: application/json
date: Tue, 28 Apr 2026 22:08:08 GMT
server: Vercel
strict-transport-security: max-age=63072000
vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch
x-matched-path: /api/fiscal/documentos
x-vercel-cache: MISS
x-vercel-id: gru1::iad1::rdl79-1777414088622-33b1f4990a87

```
```json
{"ok":false,"error":{"code":"UNAUTHENTICATED","message":"Utilizador não autenticado.","details":{"request_id":"400616b1-817e-41bb-bbe6-c027cd03e5f7"}}}
```

## 6) Retificação FT
skip: documento do passo 2 não retornou documento_id

## 7) Anulação FT
skip: documento do passo 3 não retornou documento_id

## 8) PDF Fiscal
skip: documento do passo 2 não retornou documento_id

## 9) Exportação SAF-T(AO)
```bash
curl -sS -X POST 'https://app.klasse.ao/api/fiscal/saft/export' -H 'Authorization: Bearer ***' -H 'x-escola-id: f406f5a7-a077-431c-b118-297224925726' -H 'Content-Type: application/json' --data-raw '{"empresa_id":"11a6aba6-3315-4732-a0b1-383202cf4f9d","periodo_inicio":"2026-01-01","periodo_fim":"2026-12-31","xsd_version":"AO_SAFT_1.01","metadata":{"canal":"smoke_e2e","fase":"fase_4"}}'
```
status_http: 401
```http
HTTP/2 401 
cache-control: public, max-age=0, must-revalidate
content-type: application/json
date: Tue, 28 Apr 2026 22:08:08 GMT
server: Vercel
strict-transport-security: max-age=63072000
vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch
x-matched-path: /api/fiscal/saft/export
x-vercel-cache: MISS
x-vercel-id: gru1::iad1::z7lw2-1777414088862-76019310799e

```
```json
{"ok":false,"error":{"code":"UNAUTHENTICATED","message":"Utilizador não autenticado.","details":{"request_id":"80b4b875-cc9d-451c-9d8b-b91b5ac99f35"}}}
```

## Veredito automático
| Etapa | HTTP esperado | HTTP obtido | Resultado |
|---|---|---|---|
| 1 Probe | 200 | 401 | FAIL |
| 2 FT padrão | 201 | 401 | FAIL |
| 3 FT isenta | 201 | 401 | FAIL |
| 4 RC | 201 | 401 | FAIL |
| 5 FT moeda estrangeira | 201 (opcional) | 401 | FAIL |
| 6 Retificação | 200 | SKIP | FAIL |
| 7 Anulação | 200 | SKIP | FAIL |
| 8 PDF | 200 ou 409 | SKIP | FAIL |
| 9 SAF-T | 201 ou 202 | 401 | FAIL |

status_global: FAIL
## Critérios mínimos de sucesso
- 1) Probe: HTTP 200
- 2) FT padrão: HTTP 201
- 3) FT isenta: HTTP 201
- 4) RC com PaymentMechanism: HTTP 201
- 6) Retificação: HTTP 200
- 7) Anulação: HTTP 200
- 8) PDF: HTTP 200 ou HTTP 409 FISCAL_PREVIEW_NOT_ALLOWED
- 9) SAF-T: HTTP 201 ou HTTP 202

## IDs capturados
- FT passo 2: n/a
- FT passo 3: n/a

## Notas
- Se algum POST retornar 404 SERIE_NAO_ENCONTRADA, crie/ative as séries FR (FT) e RC (RC).
- Para validar omissão do bloco Currency em AOA no XML, faça download do ficheiro SAF-T exportado e confirme ausência de <Currency> em faturas AOA.
- Para validar renderização de Currency, rode com TEST_FOREIGN_CURRENCY=1 e confirme <Currency> no documento em USD.
