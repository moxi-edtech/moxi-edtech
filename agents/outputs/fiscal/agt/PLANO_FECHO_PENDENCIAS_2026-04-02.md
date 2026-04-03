# Plano de Fecho de Pendências AGT — 2026-04-02

Objetivo: fechar os pontos documentais ainda em `EM_EXECUCAO`/`BLOQUEADO` após validação técnica do ponto 17.

## Sprint operacional (D+3)

1. PDFs obrigatórios por ponto
- Gerar e anexar em `PDFS_AGT/`:
  - `P02_FT_ANULADA_*.pdf`
  - `P03_PP_*.pdf`
  - `P04_FT_REF_PP_*.pdf`
  - `P05_NC_REF_FT_*.pdf`
  - `P06_FT_DUAS_LINHAS_*.pdf`
  - `P07_SETTLEMENT_*.pdf`
  - `P08_FX_*.pdf`
  - `P09_FT_SMALL_BEFORE10_*.pdf`
  - `P10_CLIENTE_SEM_NIF_*.pdf`
  - `P11_GR_GT_*.pdf`
  - `P12_PP_*.pdf`
  - `P14_FG_*.pdf`

2. Atualização da matriz (ponto a ponto)
- Para cada ponto: preencher `doc_id`, `numero`, `pdf`, `xml_check`, `obs`.
- Não manter `n/d` para pontos com documento já emitido.

3. Encadeamento documental
- Confirmar e evidenciar:
  - Pró-forma -> Fatura (`OrderReferences`)
  - Fatura -> Nota de Crédito (`References`)

4. Coerência temporal
- Garantir evidências em dois períodos contabilísticos distintos.
- Confirmar alinhamento entre `InvoiceDate`, `SystemEntryDate` e período do XML final.

5. Reconciliação e consistência
- Checklist por ponto:
  - PDF = XML = DB
  - HashControl presente
  - Mensão AGT no PDF
  - Totais reconciliados (`0.00` de divergência)

## Bloqueios remanescentes

- Ponto 13: auto-faturação depende de parametrização de `SelfBillingIndicator`.
- Ponto 15: depende de catálogo formal de tipos adicionais e/ou declaração de `NA` aprovada.

## Critério de saída

- Matriz 1..17 com status final `READY` ou `NA` justificado.
- Dossiê com XML + PDFs + evidências criptográficas pronto para submissão.
