# Matriz de Conformidade Documental AGT — SAF-T(AO)

Projeto: KLASSE (EdTech SaaS)  
Revisão: 2026-09-27  
Escopo: **SAF-T(AO) de Facturação — TaxAccountingBasis F**

> Fonte de verdade do estado: `docs/fiscal/certificacao/backlog-certificacao-agt.md`.
> Esta matriz não declara suporte a SAF-T contabilístico C/I. O KLASSE não mantém plano de contas nem razão de partidas dobradas.

## 1. Header e MasterFiles

| Regra | Implementação KLASSE | Estado |
|---|---|---|
| `TaxAccountingBasis` | Apenas `F`. `C/I` falha explicitamente. | READY |
| Identidade do produtor | `ProductID`, `ProductCompanyTaxID`, `ProductVersion` e `SoftwareValidationNumber` validados antes da fila. | READY |
| Reprodutibilidade | Configuração do Header é congelada no metadata da exportação no momento do pedido e reutilizada pelo worker. | READY |
| Customer | Identidade canónica por NIF; consumidor final `999999999 / Consumidor final`; morada com fallback válido. | READY |
| Product | `ProductCode`, `ProductNumberCode` e `ProductType P/S/O/E/I`; conflito de tipo/código mestre é rejeitado. | READY |
| TaxTable | Gerada a partir de `TaxCountryRegion + TaxCode + TaxPercentage` efectivamente usados. | READY |

## 2. SalesInvoices — FT/FR/FG/NC/ND e tipos mapeados

| Regra | Implementação KLASSE | Estado |
|---|---|---|
| Identificação | Número fiscal não é reescrito no exportador. Cadeia validada exige `<tipo> <seriesCode AGT>/<número>`. | READY |
| Ordem | Documentos ordenados por tipo, série e número. | READY |
| Hash | Software não validado: `Hash=0`, `HashControl=0`. Software validado: cadeia dedicada RSA-1024/SHA-1, Base64 172 chars. | READY |
| HashControl | Versão inteira positiva da chave privada SAF-T, persistida com o documento. | READY |
| GrossTotal | O valor assinado usa GrossTotal arredondado a 2 casas e o XML reconcilia com o mesmo total. | READY |
| Debit/Credit | NC/RE usam débito; documentos de venda usam crédito. Linha é líquida de IVA. | READY |
| Control totals | `TotalDebit/TotalCredit` somam apenas documentos com estado normal `N`; anulados continuam no ficheiro sem inflar os controlos. | READY |
| Anulação | `InvoiceStatus=A` usa timestamp, motivo e actor reais de `fiscal_documentos_eventos`. | READY |
| SourceID | Actor estável derivado do UUID do utilizador; não é mais o texto fixo “KLASSE”. | READY |
| Descontos | `UnitPrice` é líquido de descontos; `SettlementAmount` é preservado e convertido para AOA quando necessário. | READY |
| Moeda estrangeira | Valores de linha permanecem em AOA e `Currency` conserva moeda original/contra-valor/taxa. | READY |
| Unidade | `UnitOfMeasure` original é preservada do payload fiscal. | READY |
| IVA | `TaxCode` e `TaxCountryRegion` explícitos são preservados; fallback por taxa existe apenas para legado. | READY |
| Isenção | IVA 0 exige `TaxExemptionCode Mxx` e motivo de 6–60 caracteres. | READY |

## 3. WorkingDocuments e MovementOfGoods

| Regra | Implementação KLASSE | Estado |
|---|---|---|
| PP | Exportado em `WorkingDocuments` com Hash/HashControl quando software validado. | READY |
| GR/GT | Exportados em `MovementOfGoods`; itens têm `ProductType=P` por default do fluxo de movimentação. | READY |
| Quantidade | `TotalQuantityIssued` exclui documentos anulados. | READY |
| Totais e descontos | Mesmas regras de AOA, UnitPrice líquido, IVA/isenção e SettlementAmount. | READY |
| Estado | Anulação usa evento real, motivo e actor. | READY |

## 4. Payments — RC

| Regra | Implementação KLASSE | Estado |
|---|---|---|
| Estrutura | RC é exportado em `Payments`, sem linhas fiscais artificiais. | READY |
| Origem | `paymentReceipt.sourceDocuments` deriva das alocações append-only do BILL-007. | READY |
| Regularização | `OriginatingON`, data e `CreditAmount` líquido são preservados; sequência/duplicidade é validada. | READY |
| Meio de pagamento | `NU/TB/CC/MB` preservado. | READY |
| Hash | RC/Payments não entra na cadeia `Hash/HashControl`, pois a estrutura Payments do XSD AO 1.01_01 não contém esses campos. | READY |
| Control totals | `TotalCredit` soma apenas RC normais e reconcilia com os sourceDocuments. | READY |

## 5. XSD, semântica e evidência

| Regra | Implementação KLASSE | Estado |
|---|---|---|
| XSD | XML validado contra `SAF-T-AO1.01_01.xsd` no worker e na regressão fiscal. | READY |
| Validação semântica | Totais de linhas/documento, sourceDocuments, IVA, classificação, número fiscal, estado e moeda são validados antes do upload. | READY |
| Evidência | XML privado + SHA-256 + summary + resultado XSD/semântico em `fiscal_saft_exports`. | READY |
| Imutabilidade | Exportação `validated` não pode ser UPDATE/DELETE; identidade/período não podem mudar. | READY |
| Configuração | Header é snapshot do pedido, evitando alteração por mudança posterior de ambiente. | READY |

## 6. Evidência histórica do banco — 2026-09-27

- documentos emitidos/anulados/rectificados avaliados: **121**;
- divergências documento x soma das linhas: **0**;
- linhas IVA 0 sem Mxx/motivo válido: **0**;
- documentos anulados sem evento/motivo: **0**;
- documentos comerciais históricos com numeração não-canónica: **98**;
- RC históricos sem `paymentReceipt.sourceDocuments`: **8**;
- documentos actualmente marcados `saft_required=true`: **0**.

Os dois grupos históricos incompatíveis permanecem fail-closed. O exportador não renumera, inventa origem nem fabrica assinatura para esconder legado.

## 7. Limite contabilístico

A obrigação de SAF-T contabilístico não é satisfeita por `financeiro_ledger`. Um ficheiro C/I exige plano de contas e movimentos contabilísticos de dupla entrada (`GeneralLedgerEntries`). O KLASSE não declara essa capacidade.

Se o produto vier a oferecer contabilidade, o suporte C/I deverá ser implementado como módulo próprio ou integração contabilística, com novo backlog e homologação específica.

## Estado

**READY FOR HOMOLOGATION — SAF-T(AO) de Facturação F.**

O estado passa a CLOSED somente após validação externa/portal AGT com fixtures representativas, arquivada no BILL-013.
