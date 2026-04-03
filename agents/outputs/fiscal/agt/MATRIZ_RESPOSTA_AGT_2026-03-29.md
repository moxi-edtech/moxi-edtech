# Matriz de Resposta AGT — Pontos 1..17

Data base: 2026-03-29
Responsável técnico: David / Engenharia KLASSE
Responsável fiscal/compliance: Financeiro Escolar (a designar)

Legenda de status: `PENDENTE | EM_EXECUCAO | READY | BLOQUEADO | NA`

| Ponto | Exigência AGT | Status | Documento (doc_id) | Número | PDF | XML/Regra validada | Observações |
|---|---|---|---|---|---|---|---|
| 1 | Fatura para cliente com NIF | READY | `0fcc55b7-e0fe-4f25-8199-05c1774a31b5` | `FR FR/1` | P01_FT_FR_*.pdf (gerar pacote AGT) | Emissão FR com idempotência validada pós-migração | Evidência base: `FISCAL_SMOKE_BROWSER_FULL_PASS_20260326.md`, validações prod 20260329T002300Z e `FR_IDEMPOTENCIA_POS_MIGRACAO_2026-04-02.md` |
| 2 | Fatura anulada + PDF após anulação visível | EM_EXECUCAO | validar no ledger | FR-000004 (anulado) | P02_FT_ANULADA_*.pdf (pendente gerar) | Documento anulado existe e íntegro | Engine PDF fiscal AGT integrada; falta anexar evidência visual no pacote |
| 3 | Documento de conferência (pró-forma) | EM_EXECUCAO | `5831e698-c72c-4db8-9980-2e2cbb9731bb` | `PP PP/3` | P03_PP_*.pdf (pendente gerar) | Schema/API aceitam `PP` | Caso operacional emitido em produção (2026-04-03); falta anexar PDF |
| 4 | Fatura baseada no ponto 3 (Order References) | EM_EXECUCAO | `2230924c-37e0-41da-96df-68f9bbd75509` | `FT FR/6` | P04_FT_REF_PP_*.pdf (pendente gerar) | Builder SAF-T serializa `OrderReferences` | FT emitida com `documento_origem_id` da PP; falta validar referência no XML final |
| 5 | Nota de crédito baseada na fatura do ponto 4 | EM_EXECUCAO | `e0b4637e-b705-44d2-8e97-6eea534d078c` | `NC NC/3` | P05_NC_REF_FT_*.pdf (pendente gerar) | Encadeamento por referência suportado no XML | NC explícita emitida com `rectifica_documento_id` da FT do ponto 4; falta validação final no XML/PDF |
| 6 | Documento 2 linhas: 1 tributada (14%/5%) + 1 isenta com código | EM_EXECUCAO | validar no ledger | FT isenta validada no smoke | P06_FT_DUAS_LINHAS_*.pdf (pendente gerar) | Regras de isenção + legenda fiscal no PDF implementadas | Falta emitir caso AGT exato com 2 linhas no mesmo documento |
| 7 | Documento com qty=100, unit=0.55, desconto linha 8.8% + desconto global | EM_EXECUCAO | validar no ledger | n/d | P07_SETTLEMENT_*.pdf (pendente gerar) | `SettlementAmount` serializado por linha no SAF-T | Falta cobertura de desconto global e evidência AGT final |
| 8 | Documento em moeda estrangeira | EM_EXECUCAO | validar no ledger | n/d | P08_FX_*.pdf (pendente gerar) | Suporte ao nó `Currency` + PDF fiscal padronizado | Falta evidência emitida para AGT |
| 9 | Cliente identificado sem NIF, total < 50 AOA, registro antes 10h | EM_EXECUCAO | validar no ledger | n/d | P09_FT_SMALL_BEFORE10_*.pdf (pendente gerar) | Cenário executável + fallback fiscal refletido no PDF | Falta evidência operacional de horário + PDF |
| 10 | Outro cliente identificado sem NIF | EM_EXECUCAO | validar no ledger | n/d | P10_CLIENTE_SEM_NIF_*.pdf (pendente gerar) | Fallback fiscal implementado (`999999999` / Consumidor final) e refletido no PDF | Falta evidência documental AGT dedicada |
| 11 | Duas guias de remessa | EM_EXECUCAO | validar no ledger | n/d | P11_GR_GT_*.pdf (pendente gerar) | Schema/API aceitam `GR`/`GT` e PDF suporta tipologia | Falta validação de layout/regras AGT por tipologia |
| 12 | Orçamento ou fatura pró-forma | EM_EXECUCAO | validar no ledger | n/d | P12_PP_*.pdf (pendente gerar) | Schema/API aceitam `PP` e PDF suporta tipologia | Falta evidência documental AGT dedicada |
| 13 | Fatura genérica e outra de auto-faturação | BLOQUEADO | n/a | n/a | n/a | Sem modelagem explícita de auto-faturação (`SelfBillingIndicator` fixo em 0) | Requer parametrização de engine ou NA formal aprovado |
| 14 | Fatura global | EM_EXECUCAO | validar no ledger | n/d | P14_FG_*.pdf (pendente gerar) | Schema/API aceitam `FG` e PDF suporta tipologia | Falta validação operacional e prova no pacote AGT |
| 15 | Outros tipos de documento emitidos pela aplicação | BLOQUEADO | n/a | n/a | n/a | Tipologias adicionais não expostas no contrato atual | Requer catálogo formal de tipos + implementação/NA |
| 16 | Indicação do documento enviado por cada ponto | EM_EXECUCAO | n/a | n/a | n/a | Matriz criada e em preenchimento | Documento presente em `agents/outputs/fiscal/agt/` |
| 17 | SAF-T único com todos exemplos e HashControl preenchido | READY | 0998ad5b-1c05-4a0c-9348-e277080b783b (2026-03-01..2026-03-31) | n/a | SAFT_AGT_UNICO_2026-03.xml | XSD oficial validado após reprocessamentos (passou em 2026-04-02) | Export consolidado e elegível como evidência técnica oficial |

## Itens de bloqueio identificados

| ID | Descrição | Impacto | Responsável | ETA | Status |
|---|---|---|---|---|---|
| BLK-001 | Inngest sem função trigger em alguns eventos (histórico preso em queued) | impede geração assíncrona estável | Engenharia Plataforma | 2026-03-30 | EM_TRATAMENTO |
| BLK-002 | Evidências PDF AGT ainda não empacotadas ponto a ponto | risco de indeferimento documental | Operações Fiscal | 2026-04-02 | ABERTO |
| BLK-003 | Cobertura operacional das tipologias 3/4/5/11/12/13/14 ainda sem evidência final | risco de lacuna de conformidade | Produto + Engenharia Fiscal | 2026-04-05 | ABERTO |
| BLK-004 | Ponto 7 ainda sem desconto global consolidado e evidência final AGT | risco de reprovação por inconsistência de cálculo | Engenharia Fiscal | 2026-04-03 | EM_TRATAMENTO |
| BLK-005 | Evidências PDF ainda não anexadas apesar de engine documental integrada em 2026-04-01 | risco de atraso no dossiê AGT | Operações Fiscal | 2026-04-02 | ABERTO |

## Atualização de execução (2026-04-03 — cobertura mínima tipológica)

- Emissão mínima autenticada concluída com sucesso para: `FT`, `FR`, `RC`, `ND`, `NC`, `PP`, `GR`, `GT`, `FG`.
- Evidências operacionais anexadas:
  - `FISCAL_TIPOS_MINIMO_EXEC_20260402T225502Z.md`
  - `FISCAL_TIPOS_MINIMO_EXEC_20260402T225730Z.md`
- A frente de tipologia saiu de `BLOQUEADO` para `EM_EXECUCAO` nos pontos com emissão já demonstrada, permanecendo pendente o pacote documental AGT (PDFs por ponto + validações finais).

## Observação de template PDF (2026-04-03)

- O endpoint `/api/fiscal/documentos/[documentoId]/pdf` está operacional para as tipologias em cobertura mínima.
- O template atual ainda é único (`FiscalDocumentV1`) e aplica variação de título/menções por tipo, sem layout dedicado por tipologia.

## Atualização de execução (2026-04-02)

- Ponto 17 atualizado para `READY` com exportação mensal de março consolidada e validação XSD concluída.
- Próxima prioridade operacional: fechar pontos documentais pendentes (2/3/4/5/6/7/8/9/10/11/12/14/15) com evidência PDF e mapeamento final na matriz.

## Atualização de execução (2026-04-02 — pós-fix FR)

- Migração aplicada em produção: `20260402133000_fix_fr_numero_formatado_idempotencia.sql`.
- Teste de idempotência FR concluído com sucesso:
  - 2 chamadas com mesmo `origem_operacao/origem_id` retornaram o mesmo `documento_id`.
  - 1 chamada com `origem_id` diferente retornou novo `documento_id` e novo `numero_formatado`.
- Série semântica necessária para o adapter (`FR`, prefixo `FR`, origem `integrado`) criada/ativada para a empresa fiscal.

## Atualização de execução (2026-04-03 — pontos 3/4/5)

- Ponto 3 (PP) emitido: `doc_id=5831e698-c72c-4db8-9980-2e2cbb9731bb`, `numero=PP PP/3`.
- Ponto 4 (FT referenciando PP) emitido: `doc_id=2230924c-37e0-41da-96df-68f9bbd75509`, `numero=FT FR/6`.
- Ponto 5 (NC sobre FT do ponto 4) emitido explicitamente: `doc_id=e0b4637e-b705-44d2-8e97-6eea534d078c`, `numero=NC NC/3`.
- Observação técnica: endpoint `rectificar` atualiza status para `rectificado` no documento origem; para evidência AGT de NC foi usada emissão explícita `tipo_documento=NC` com `rectifica_documento_id`.

## Evidências anexadas

- SAF-T único: `SAFT_AGT_UNICO_2026-03.xml`
- Hash validation: `../FISCAL_HASH_VALIDATION_PROD_20260328.md`
- Signature validation: `../FISCAL_SIGNATURE_VALIDATION_PROD_20260328.md`
- Replay audit: `../FISCAL_REPLAY_AUDIT_PROD_20260328.md`
- Playbook de execução: `PAYLOADS_EXECUCAO_AGT_2026-03-30.md`

## Veredito interno

- Estado atual: `NO-GO controlado`
- Condição para `GO`: fechar pontos pendentes (2/6/7/8/9/10/11/12/13/14/15), anexar PDFs e validações finais de 3/4/5, e consolidar XML único final do pacote AGT.
