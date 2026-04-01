# Índice do Pacote AGT — KLASSE

Data base: 2026-03-29
Objetivo: centralizar os artefatos de resposta ao ofício AGT (Ref: 0000498/01180000/AGT/2026).

## Estrutura deste pacote

- `MATRIZ_RESPOSTA_AGT_2026-03-29.md`
  - matriz oficial de resposta dos pontos 1..17
  - mapeamento ponto -> documento -> evidência
- `CHECKLIST_EXECUCAO_AGT_2026-03-29.md`
  - checklist de execução diária e pré-submissão
- `PAYLOADS_EXECUCAO_AGT_2026-03-30.md`
  - payloads/curls operacionais e bloqueios técnicos por ponto AGT
- `PDF engine fiscal (2026-04-01)`
  - endpoint oficial: `/api/fiscal/documentos/[documentoId]/pdf`
  - template: `apps/web/src/templates/pdf/fiscal/FiscalDocumentV1.tsx`
  - status: integrado com menção AGT, assinatura curta e fallback `0/AGT`
- `PDFS_AGT/`
  - PDFs finais por ponto AGT
- `SAFT_AGT_UNICO_2026-03.xml`
  - XML SAF-T único com todos os exemplos aplicáveis
- `FISCAL_HASH_VALIDATION_PROD_YYYYMMDD.md`
  - evidência de validação de hash_control
- `FISCAL_SIGNATURE_VALIDATION_PROD_YYYYMMDD.md`
  - evidência de validação de assinatura
- `FISCAL_REPLAY_AUDIT_PROD_YYYYMMDD.md`
  - evidência de replay audit da cadeia

## Convenção de nomes para PDFs

Formato recomendado: `PXX_<TIPO>_<NUMERO>_<YYYYMMDD>.pdf`

Exemplos:
- `P01_FT_FR_2026_0001_20260401.pdf`
- `P02_FT_ANULADA_2026_0002_20260401.pdf`
- `P10_GR_2026_0005_20260402.pdf`

## Regras de preenchimento

1. Cada ponto AGT deve ter: `status`, `doc_id`, `numero_formatado`, `pdf`, `xml_check`, `obs`.
2. Quando não aplicável, preencher `status = NA` e justificar tecnicamente no campo `obs`.
3. Não deixar campos críticos em branco para pontos marcados como `READY`.
4. O ponto 17 só pode ser `READY` com validação XSD oficial e hash/signature/replay anexados.
5. Para pontos com suporte parcial/ausente, usar `BLOQUEADO` com referência ao playbook técnico.

## Veredito

- GO: todos os pontos `READY` ou `NA` justificado + ponto 17 validado.
- NO-GO: qualquer ponto obrigatório sem evidência ou com inconsistência técnica.
