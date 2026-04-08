# Plano de Fecho de Pendências AGT — 2026-04-02

Objetivo: fechar os pontos documentais ainda em `EM_EXECUCAO`/`BLOQUEADO` após validação técnica do ponto 17.

## Linha de execução imediata (D+1 a D+3)

### D+1 — Fechar pontos já emitidos (evidência documental)

1. Gerar e anexar PDFs em `PDFS_AGT/`:
- `P02_FT_ANULADA_<NUMERO>_<YYYYMMDD>.pdf`
- `P03_PP_<NUMERO>_<YYYYMMDD>.pdf`
- `P04_FT_REF_PP_<NUMERO>_<YYYYMMDD>.pdf`
- `P05_NC_REF_FT_<NUMERO>_<YYYYMMDD>.pdf`
- `P11_GR_01_<NUMERO>_<YYYYMMDD>.pdf`
- `P11_GT_02_<NUMERO>_<YYYYMMDD>.pdf`
- `P12_PP_<NUMERO>_<YYYYMMDD>.pdf`
- `P14_FG_<NUMERO>_<YYYYMMDD>.pdf`

2. Atualizar matriz (`MATRIZ_RESPOSTA_AGT_2026-03-29.md`) com:
- `doc_id`
- `numero`
- nome final do `pdf`
- `xml_check` (campo validado)

### D+2 — Executar cenários faltantes de conteúdo

1. Emitir casos e anexar PDFs:
- `P06_FT_DUAS_LINHAS_<NUMERO>_<YYYYMMDD>.pdf`
- `P07_SETTLEMENT_<NUMERO>_<YYYYMMDD>.pdf` (linha 8.8% + desconto global)
- `P08_FX_<NUMERO>_<YYYYMMDD>.pdf` (moeda estrangeira)
- `P09_FT_SMALL_BEFORE10_<NUMERO>_<YYYYMMDD>.pdf`
- `P10_CLIENTE_SEM_NIF_<NUMERO>_<YYYYMMDD>.pdf`

2. Validar por ponto:
- `PDF = XML = DB`
- `HashControl` presente
- menção AGT no PDF
- reconciliação decimal (`0.0000`)

### D+3 — Fecho técnico/compliance

1. Encadeamento documental:
- Pró-forma -> Fatura (`OrderReferences`)
- Fatura -> Nota de Crédito (`References`)

2. Coerência temporal:
- evidências em pelo menos 2 períodos contabilísticos
- `InvoiceDate`/`SystemEntryDate` alinhados

3. Estado final de pontos críticos:
- Ponto 13: implementar `SelfBillingIndicator` dinâmico **ou** registrar `NA` formal aprovado.
- Ponto 15: executar tipos adicionais **ou** registrar `NA` formal aprovado.

4. Fechar checklist e matriz para submissão.

## Lista fechada de PDFs por ponto AGT

- P01: `P01_FT_FR_<NUMERO>_<YYYYMMDD>.pdf`
- P02: `P02_FT_ANULADA_<NUMERO>_<YYYYMMDD>.pdf`
- P03: `P03_PP_<NUMERO>_<YYYYMMDD>.pdf`
- P04: `P04_FT_REF_PP_<NUMERO>_<YYYYMMDD>.pdf`
- P05: `P05_NC_REF_FT_<NUMERO>_<YYYYMMDD>.pdf`
- P06: `P06_FT_DUAS_LINHAS_<NUMERO>_<YYYYMMDD>.pdf`
- P07: `P07_SETTLEMENT_<NUMERO>_<YYYYMMDD>.pdf`
- P08: `P08_FX_<NUMERO>_<YYYYMMDD>.pdf`
- P09: `P09_FT_SMALL_BEFORE10_<NUMERO>_<YYYYMMDD>.pdf`
- P10: `P10_CLIENTE_SEM_NIF_<NUMERO>_<YYYYMMDD>.pdf`
- P11: `P11_GR_01_<NUMERO>_<YYYYMMDD>.pdf` e `P11_GT_02_<NUMERO>_<YYYYMMDD>.pdf`
- P12: `P12_PP_<NUMERO>_<YYYYMMDD>.pdf`
- P13: `P13_GF_SELF_BILLING_<NUMERO>_<YYYYMMDD>.pdf` (se aplicável)
- P14: `P14_FG_<NUMERO>_<YYYYMMDD>.pdf`
- P15: `P15_OUTROS_<TIPO>_<NUMERO>_<YYYYMMDD>.pdf` (se aplicável)

## Bloqueios remanescentes

- Ponto 13: auto-faturação depende de parametrização de `SelfBillingIndicator` (ou `NA` formal).
- Ponto 15: depende de catálogo formal de tipos adicionais (ou `NA` formal).

## Critério de saída

- Matriz 1..17 com status final `READY` ou `NA` justificado.
- Dossiê com XML + PDFs + evidências criptográficas pronto para submissão.
