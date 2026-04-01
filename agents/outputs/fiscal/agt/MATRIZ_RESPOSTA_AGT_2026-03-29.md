# Matriz de Resposta AGT — Pontos 1..17

Data base: 2026-03-29
Responsável técnico: David / Engenharia KLASSE
Responsável fiscal/compliance: Financeiro Escolar (a designar)

Legenda de status: `PENDENTE | EM_EXECUCAO | READY | BLOQUEADO | NA`

| Ponto | Exigência AGT | Status | Documento (doc_id) | Número | PDF | XML/Regra validada | Observações |
|---|---|---|---|---|---|---|---|
| 1 | Fatura para cliente com NIF | READY | validar no ledger | FR-000001 / FR-000002 | P01_FT_FR_*.pdf (gerar pacote AGT) | Emissão FT PASS (smoke) + assinatura/hash PASS (prod) | Evidência base: `FISCAL_SMOKE_BROWSER_FULL_PASS_20260326.md` + validações prod 20260329T002300Z |
| 2 | Fatura anulada + PDF após anulação visível | EM_EXECUCAO | validar no ledger | FR-000004 (anulado) | P02_FT_ANULADA_*.pdf (pendente gerar) | Documento anulado existe e íntegro | Engine PDF fiscal AGT integrada; falta anexar evidência visual no pacote |
| 3 | Documento de conferência (pró-forma) | EM_EXECUCAO | validar no ledger | n/d | P03_PP_*.pdf (pendente gerar) | Schema/API aceitam `PP` | Falta gerar evidência operacional AGT |
| 4 | Fatura baseada no ponto 3 (Order References) | EM_EXECUCAO | validar no ledger | n/d | P04_FT_REF_PP_*.pdf (pendente gerar) | Builder SAF-T serializa `OrderReferences` | Falta emitir caso com vínculo explícito e validar XML final |
| 5 | Nota de crédito baseada na fatura do ponto 4 | EM_EXECUCAO | validar no ledger | n/d | P05_NC_REF_FT_*.pdf (pendente gerar) | Encadeamento por referência suportado no XML | Falta evidência documental do fluxo completo |
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
| 17 | SAF-T único com todos exemplos e HashControl preenchido | EM_EXECUCAO | e346bf72-35f1-4b1a-a606-4861cf8c9466 (jan/2026, em reprocesso) | n/a | SAFT_AGT_UNICO_2026-03.xml (pendente consolidar) | XSD oficial ativo + hash/signature/replay PASS em produção | Falta consolidar XML único final com todos exemplos AGT |

## Itens de bloqueio identificados

| ID | Descrição | Impacto | Responsável | ETA | Status |
|---|---|---|---|---|---|
| BLK-001 | Inngest sem função trigger em alguns eventos (histórico preso em queued) | impede geração assíncrona estável | Engenharia Plataforma | 2026-03-30 | EM_TRATAMENTO |
| BLK-002 | Evidências PDF AGT ainda não empacotadas ponto a ponto | risco de indeferimento documental | Operações Fiscal | 2026-04-02 | ABERTO |
| BLK-003 | Cobertura operacional das tipologias 3/4/5/11/12/13/14 ainda sem evidência final | risco de lacuna de conformidade | Produto + Engenharia Fiscal | 2026-04-05 | ABERTO |
| BLK-004 | Ponto 7 ainda sem desconto global consolidado e evidência final AGT | risco de reprovação por inconsistência de cálculo | Engenharia Fiscal | 2026-04-03 | EM_TRATAMENTO |
| BLK-005 | Evidências PDF ainda não anexadas apesar de engine documental integrada em 2026-04-01 | risco de atraso no dossiê AGT | Operações Fiscal | 2026-04-02 | ABERTO |

## Evidências anexadas

- SAF-T único: `SAFT_AGT_UNICO_2026-03.xml`
- Hash validation: `../FISCAL_HASH_VALIDATION_PROD_20260328.md`
- Signature validation: `../FISCAL_SIGNATURE_VALIDATION_PROD_20260328.md`
- Replay audit: `../FISCAL_REPLAY_AUDIT_PROD_20260328.md`
- Playbook de execução: `PAYLOADS_EXECUCAO_AGT_2026-03-30.md`

## Veredito interno

- Estado atual: `NO-GO controlado`
- Condição para `GO`: fechar pontos 3/4/5/7/8/9/11/12/13/14/15 com evidência operacional + consolidar XML único final do pacote AGT.
