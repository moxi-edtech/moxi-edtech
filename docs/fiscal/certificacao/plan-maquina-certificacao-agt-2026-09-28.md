# Plano de execução — Máquina de Certificação AGT

Data: 2026-09-28
Base: `fix/bill-010-document-lifecycle`
Objetivo: tornar o fluxo pós-desbloqueio externo reduzido a
`provisionar -> executar -> validar -> entregar à AGT`.

## Restrições inegociáveis

- Nenhuma chamada real à AGT nesta sprint.
- `fiscal:agt:certification:run` é dry-run por padrão.
- Execução futura exige `--execute` + ACK literal e preflight verde.
- Nenhuma migration aplicada ao projecto live
  `wjtifcpxxxotsbmvbgoq`.
- Nenhum DELETE/UPDATE reaberto em ledger/documentos/itens/eventos/SAF-T.
- BILL-001..003/009 permanecem fail-closed e os negative tests são gate final.
- Segredos, Basic Auth, tokens, sessão, JWS completo e referências privadas KMS
  nunca aparecem em logs/evidence/commits.
- Resultado externo incerto nunca é reenviado automaticamente.

## Fatos confirmados do código/schema

- FE emitível pelo mapper/AGT inclui FT/FR/FG/GF/NC/ND/RC/RE; escopo de
  certificação desta sprint exige FT/NC/ND/RC/FG e RE somente se declarado.
- PP, GR e GT usam séries locais legacy; FE exige série
  `agt_status=provisioned` para ano/regime.
- `fiscal_series_requests` possui:
  idempotency_key, submission_uuid, status, fiscal_serie_id,
  response_payload/error_payload.
- `fiscal_agt_submissions` possui submission_uuid, request_id, status,
  result_code, payloads, attempt/poll budgets e DLQ.
- `fiscal_agt_submission_documentos` liga submission -> documento.
- `fiscal_documentos` e `fiscal_documento_itens` já persistem os campos
  necessários a P01-P15, FX, settlement, referências e SAF-T.
- O builder SAF-T aceita uma coleção explícita de documentos; portanto P17
  será construído a partir dos IDs do manifest, não apenas por período.

## Trilhas

### T1 — Runner P01-P15 + manifest

Entregáveis:

- `src/lib/fiscal/certification/types.ts`
- `src/lib/fiscal/certification/scenarios.ts`
- `src/lib/fiscal/certification/runner.ts`
- `src/lib/fiscal/certification/httpTransport.ts`
- `tools/fiscal/agt-certification-run.ts`

Regras:

- dry-run por padrão;
- `--execute` requer `--ack=EXECUTE_AGT_CERTIFICATION_DATASET`;
- nenhum endpoint AGT é chamado diretamente;
- transporte de execução usa os endpoints internos autenticados do KLASSE;
- P09 depende de clock injetável e hora real Africa/Luanda < 10:00;
- cada cenário tem chave lógica estável;
- manifest registra `planned/executed/blocked/uncertain`;
- `uncertain` bloqueia replay automático.

### T2 — P16/P17 + evidence pack

Entregáveis:

- generator P16 a partir de manifest + snapshots DB/submission;
- P17 gera SAF-T usando exatamente os IDs do manifest;
- XSD + semântica + reconciliação + cobertura dos pontos;
- SHA-256 final;
- pack:
  `agents/outputs/fiscal/agt/certificacao-0000498/<run-id>/...`.

O gerador não grava em tabelas fiscais; só produz artefactos locais.

### T3 — Cross-validator + PDF golden contracts

Valida:

- DB <-> PDF model <-> SAF-T <-> AGT prepared payload;
- número, data, NIF, nome, moeda, FX, descontos, IVA e referências.

Goldens estruturais:

- P07 descontos;
- P08 USD;
- P09/P10 cliente identificado sem NIF;
- anulado;
- NC referenciada.

Sem snapshot binário frágil; testes validam modelo/conteúdo textual e invariantes.

### T4 — Series CLI + uncertain reconciler + sanitizer

Comandos:

- `fiscal:agt:series:preflight`
- `fiscal:agt:series:provision`
- `fiscal:agt:series:status`
- `fiscal:agt:series:reconcile`

Todos dry-run por padrão. Provision futuro requer ACK literal, HML guard e
idempotency key determinística. `uncertain` nunca reprovisiona; reconciler
apenas consulta/produz decisão/evidence. Se não existir endpoint normativo
seguro para confirmar o resultado, marca blocker manual.

Sanitizer recursivo remove/hasheia campos sensíveis.

### T5 — CI dedicado + readiness

Workflow `Fiscal Certification` independente do KF2:

- schema/plan;
- engine/tax;
- P07-P10;
- SAF-T semantic;
- XSD;
- mapper;
- JWS;
- series contracts;
- evidence sanitizer;
- BILL-001..003/009 negatives;
- BILL-018 regression.

Readiness gera estado por P01-P17 e blockers externos.

### T6 — BILL-018 hardening tests

Sem aplicar migration live:

- rollback/erro de operação;
- concorrência/replay;
- idempotency key estável;
- compatibilidade de históricos NULL;
- direct writers/legacy RPC guards;
- prova de que a migration não requer backfill destrutivo.

## Dependências

```
T1 -> T2
T1 -> T3
T4 -> readiness
T2 -> readiness
T3 -> readiness
T6 independente
CI depende de T1-T6
```

## Definition of Done

- CLI e libs compilam no workflow.
- Toda execução destrutiva/external-write é opt-in explícita.
- Testes fiscais, security e negative invariants verdes.
- Workflow Fiscal Certification verde independentemente do KF2.
- Nenhum secret-like value no diff/evidence fixtures.
- P01-P17 possuem estado determinístico.
- P17 comprova cobertura exata do manifest.
- Produção permanece sem migrations novas e sem chamadas AGT.
