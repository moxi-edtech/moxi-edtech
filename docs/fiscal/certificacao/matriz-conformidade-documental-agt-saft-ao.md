# Matriz de Conformidade Documental AGT (SAF-T AO)

Projeto: KLASSE (EdTech SaaS)  
Data de Atualização: 26 de Março de 2026  
Objetivo: Mapear a conformidade rigorosa da arquitetura de emissão do KLASSE contra o Decreto Presidencial nº 312/18 e o XSD oficial `SAF-T-AO1.01_01.xsd`.

## 1. Faturas (FT) e Faturas-Recibo (FR)
Documentos de venda base. Mapeados na Tabela 4.1 do SAF-T (`SalesInvoices`).

| Regra AGT (Condição) | Exigência XML | Implementação KLASSE (Evidência) | Status |
|---|---|---|---|
| Isenção de Imposto (Quando `TaxPercentage` ou `TaxAmount` = 0) | Preenchimento obrigatório de `<TaxExemptionReason>` e `<TaxExemptionCode>`. | `CHECK` constraint em `public.fiscal_documento_itens` que barra `INSERT`s sem os códigos legais quando IVA = 0. Zod schema `fiscalDocumentoItemSchema` forçando validação na API. | GO |
| Moeda Local (Quando emissão for em AOA) | Omissão total do nó `<Currency>`. | Lógica condicional no construtor `buildSaftAoXml` em `saftAo.ts` que suprime a árvore `<Currency>` inteira para a moeda base. | GO |
| Código de Barras Ausente (Serviços EdTech) | `<ProductNumberCode>` deve espelhar `<ProductCode>`. | Fallback implementado no gerador XML: `product_number_code ?? product_code`. | GO |

## 2. Notas de Crédito (NC)
Documentos de retificação/anulação de valores faturados. Mapeados na Tabela 4.1 (`SalesInvoices`) com `InvoiceType = "NC"`.

| Regra AGT (Condição) | Exigência XML | Implementação KLASSE (Evidência) | Status |
|---|---|---|---|
| Referência à Origem (Sempre que emitir NC) | Preenchimento obrigatório do bloco `<References>` com `<Reference>` (ID único da fatura de origem) e `<Reason>`. | Rota `[documentoId]/rectificar/route.ts` exige a Foreign Key da fatura original. O XML constrói o nó `References` com base na relação `parent_document_id`. | GO |
| Integridade Relacional | Garantir rastreabilidade de anulações. | RPC do Supabase `fiscal_rectificar_anular_rpc` garante a atomicidade da transação, anulando a origem e gerando a NC no mesmo commit. | GO |

## 3. Recibos (RC)
Documentos de prova de pagamento (Regime de Caixa). Vivem numa tabela isolada: 4.4 (`Payments`).

| Regra AGT (Condição) | Exigência XML | Implementação KLASSE (Evidência) | Status |
|---|---|---|---|
| Meios de Pagamento (Sempre que emitir RC) | Preenchimento obrigatório do nó `<PaymentMechanism>` com códigos oficiais (ex: `NU`, `TB`, `MB`, `CC`). | Zod enum estrito em `fiscal-documento.schema.ts` e campo obrigatório `payment_mechanism`. Sem texto livre. | GO |
| Referência da Fatura | Nó `<SourceDocumentID>` com `<OriginatingON>` e `<InvoiceDate>` da fatura liquidada. | Relacionamento 1:N no DB entre Pagamentos e Faturas. Exportador XML itera sobre faturas liquidadas no recibo. | GO |

## 4. Metadados e Consumidor Final (Regras Globais)

| Regra AGT (Condição) | Exigência XML | Implementação KLASSE (Evidência) | Status |
|---|---|---|---|
| Cliente sem Cadastro | NIF genérico obrigatório e nome fixo. | Fallback na API (`route.ts`): NIF `999999999` e `<CompanyName> = "Consumidor final"`. | GO |
| Moradas em Branco | Os nós de morada não podem estar vazios para consumidor final. | Fallback no construtor XML (`saftAo.ts`): `<AddressDetail>`, `<City>`, `<PostalCode>`, e `<Country>` forçados para a string `"Desconhecido"`. | GO |
| Sistema Contabilístico | Identificação do tipo de software. | Variável `<TaxAccountingBasis>` configurada para `"F"` (Facturação) ou `"C"` (Contabilidade). | GO |
| Validação Estrutural | Conformidade com XSD oficial. | Rotina CI/CD `saftXsdValidator.ts` acoplada contra `SAF-T-AO1.01_01.xsd`. | GO |

## Conclusão
Com esta matriz versionada no repositório, o Dossiê Técnico para a AGT fica auditável, rastreável e alinhado às regras estruturais do SAF-T AO.
