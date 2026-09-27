# Documentacao Fiscal KLASSE

Esta pasta centraliza toda a documentacao fiscal para evitar dispersao em multiplos diretórios.

## Estrutura

- `certificacao/`
  - checklists AGT, go-live pack, dossie tecnico, matriz de conformidade, procedimentos de validacao.
- `politicas/`
  - politicas de retencao/acesso ao ledger e rotacao/versionamento de chaves.
- `operacao/`
  - procedimentos operacionais (ex.: configuracao AWS/KMS).
- `api/`
  - contratos e guias das APIs fiscais.
- `ui/`
  - notas de UX/UI do modulo fiscal.

## Fonte de verdade do backlog

O backlog canónico da certificação AGT é:

`docs/fiscal/certificacao/backlog-certificacao-agt.md`

Estados de BILL, dependências, critérios de fecho e a ordem de execução devem ser actualizados nesse ficheiro no mesmo PR em que o gap é alterado.

## Regra de organizacao

Novos documentos fiscais devem ser criados dentro de `docs/fiscal/` e suas subpastas.
