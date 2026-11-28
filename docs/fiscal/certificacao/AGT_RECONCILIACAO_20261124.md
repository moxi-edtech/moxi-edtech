# Reconciliação fiscal AGT — 2026-11-24

Status: NO-GO para submissão formal e activação. Epic #440, dependência #308.

## Painel único de acompanhamento — snapshot de 24/11/2026

**Decisão: NO-GO para submissão formal, deploy e activação fiscal.** GO apenas para desenvolvimento e validação isolada. Este documento é a fonte única de acompanhamento; os relatórios BILL são anexos técnicos. Evidência de CI é imutável por SHA, não uma declaração de aprovação de commits posteriores.

- PR [#468](https://github.com/moxi-edtech/moxi-edtech/pull/468), draft, sem merge. Commit efectivamente testado: [`790bc74233227af49bef40a57063ca9bcf6fa64a`](https://github.com/moxi-edtech/moxi-edtech/commit/790bc74233227af49bef40a57063ca9bcf6fa64a).
- **13/13 checks, 9/9 workflows, zero falhas ou pendentes** no SHA acima. [Histórico de checks do commit](https://github.com/moxi-edtech/moxi-edtech/commit/790bc74233227af49bef40a57063ca9bcf6fa64a/checks).
- Branch reconciliada em 42c44945 com main 6fe5bf4a; na consulta documental seguinte, a main já avançara 8 commits. Reconciliar novamente e revalidar antes de qualquer integração. Não confundir CI anterior com o do próximo commit documental.
- Último snapshot de catálogo documentado: 2 vínculos fiscais desactivados; 4 RPCs críticas sem EXECUTE para as 3 roles API. Não houve nova consulta ao banco nesta actualização, nem migração, chamada AGT/KMS, grant, deploy ou activação. As quatro RPCs adicionais e os writers indirectos continuam em revisão.
- **5/10 módulos com evidência isolada parcial; 0/17 pontos P01–P17 homologados nesta entrega.** Não é percentual de certificação AGT.

### Evidência de CI (13 jobs)

| Check | Resultado | Evidência |
|---|---|---|
| Academic operations — RLS, retries, exams and publications | PASS | [Job 138830131933](https://github.com/moxi-edtech/moxi-edtech/actions/runs/45502789114/job/138830131933) |
| Academic operations — web regression and typecheck | PASS | [Job 138830131929](https://github.com/moxi-edtech/moxi-edtech/actions/runs/45502789114/job/138830131929) |
| Secretary buttons — real SQL effects and atomic audit | PASS | [Job 138830131267](https://github.com/moxi-edtech/moxi-edtech/actions/runs/45502789114/job/138830131267) |
| Theme preference tests | PASS | [Job 138830130917](https://github.com/moxi-edtech/moxi-edtech/actions/runs/45502789002/job/138830130917) |
| Theme operations — 4 widths × 3 zooms × Claro/Escuro/Sistema | PASS | [Job 138830130734](https://github.com/moxi-edtech/moxi-edtech/actions/runs/45502789002/job/138830130734) |
| full-unit-suite | PASS | [Job 138830130401](https://github.com/moxi-edtech/moxi-edtech/actions/runs/45502788606/job/138830130401) |
| bill023-postgres17 | PASS | [Job 138830130327](https://github.com/moxi-edtech/moxi-edtech/actions/runs/45502788925/job/138830130327) |
| bill045-postgres17 | PASS | [Job 138830130279](https://github.com/moxi-edtech/moxi-edtech/actions/runs/45502789040/job/138830130279) |
| targeted-contracts | PASS | [Job 138830130249](https://github.com/moxi-edtech/moxi-edtech/actions/runs/45502788606/job/138830130249) |
| kf2-search-audit | PASS | [Job 138830130146](https://github.com/moxi-edtech/moxi-edtech/actions/runs/45502788634/job/138830130146) |
| bill001-postgres17 | PASS | [Job 138830129967](https://github.com/moxi-edtech/moxi-edtech/actions/runs/45502788677/job/138830129967) |
| Prevent production dynamic-route 500s | PASS | [Job 138830129750](https://github.com/moxi-edtech/moxi-edtech/actions/runs/45502788647/job/138830129750) |
| isolated-fiscal-units | PASS | [Job 138830129442](https://github.com/moxi-edtech/moxi-edtech/actions/runs/45502788640/job/138830129442) |

Os três workflows PostgreSQL 17 executam fixtures descartáveis; o job BILL-045 confirmou explicitamente 32 reservas consecutivas únicas e os três contratos estáticos (delegação ao SSOT, ACL privada e rota antiga sem escrita). As funções completas de emissão/recibo **não** foram executadas nesse fixture. Os checks gerais cobrem regressões académicas, portais, pesquisa, tema, rotas e typecheck; não equivalem à aprovação fiscal externa.

### Roadmap BILL e critério de fecho

| Módulo | Estado neste snapshot | Evidência / critério restante |
|---|---|---|
| BILL-001 — Imutabilidade documental | PASS isolado + catálogo | [Relatório](BILL001_EVIDENCIA_20261124.md), [CI](https://github.com/moxi-edtech/moxi-edtech/actions/runs/45502788677); schema completo, writers indirectos e ACL efectiva |
| BILL-002 — Linhas e eventos | PASS isolado + catálogo | [Relatório](BILL002_003_EVIDENCIA_20261124.md), [CI](https://github.com/moxi-edtech/moxi-edtech/actions/runs/45502788925); integrar bloqueio de parent e validar fluxos reais |
| BILL-003 — Numeração | PASS isolado | [Relatório](BILL002_003_EVIDENCIA_20261124.md), [CI](https://github.com/moxi-edtech/moxi-edtech/actions/runs/45502788925); rollback, concorrência e unicidade no schema integral |
| BILL-004 — Contrato de emissão | PASS núcleo e contrato estático | [Relatório](BILL004_005_EVIDENCIA_20261124.md), [CI](https://github.com/moxi-edtech/moxi-edtech/actions/runs/45502789040); executar wrappers completos FT/RC, auth real, assinatura, idempotência, vínculo escolar |
| BILL-005 — Séries AGT | PASS núcleo sintético | [Relatório](BILL004_005_EVIDENCIA_20261124.md), [CI](https://github.com/moxi-edtech/moxi-edtech/actions/runs/45502789040); validar contrato oficial, evidência autêntica de provisionamento e série RC única |
| BILL-006 — Submissões AGT | Pendente | Schema 2/JWS, outbox, estados, idempotência, retry e rejeição; doubles offline; nenhuma chamada real |
| BILL-007 — Alocações financeiras | Pendente | Ledger append-only, reversões idempotentes, FR/RC, pagamentos parciais/lote, isolamento; regressões de propinas e recibos operacionais |
| BILL-008 — SAF-T AO | Pendente | XSD oficial, semântica, Hash/HashControl, referências, exportação integral, paridade PDF/XML/DB |
| BILL-009 — Motor tributário | Pendente | Perfis versionados, M21, descontos, câmbio e decimal exacto; integrar consumidores sem regressões |
| BILL-010 — Ciclo documental | Pendente | Anulação/rectificação, NC/ND/RC, limites cumulativos, rejeições, contingência e invariantes transaccionais |

### Dependências transversais e próximos passos

| Prioridade | Entrega | Estado / aceitação |
|---|---|---|
| P0 | Proveniência [#308](https://github.com/moxi-edtech/moxi-edtech/issues/308) | [Manifesto 59/59](evidence/migration-provenance-20261124.json): 37 exactas, 15 normalizadas nas fronteiras, 6 correspondências por tokens a rever, 1 freeze equivalente por tokens com versão distinta. Não é paridade semântica. |
| P0 | Freeze [#440](https://github.com/moxi-edtech/moxi-edtech/issues/440) | Auditar consumidores das quatro RPCs adicionais e service_role INSERT em séries; proposta de revogação específica, sem aplicação automática |
| P0 | Replay isolado PG17 | Resolver seis fontes e linhagem do freeze; schema completo, pg_cron, ACL/RLS/triggers e replay limpo; sem reparar ledger remoto |
| P0 | BILL-006 + BILL-007 | Próxima frente de implementação offline, preservar recibos operacionais e pagamentos |
| P0 | BILL-008–010 e integração BILL-001–005 | Testes reais sobre schema descartável; validação de assinaturas e efeitos transaccionais; candidatos fora de supabase/migrations |
| P0 | P01–P17 e dossiê AGT | Confirmar ofício original, âmbito F e critérios, obter evidência externa em ambiente autorizado; manter todos os pontos pendentes até prova |
| P0 | Aprovação para activação | Certificação AGT verificável e autorização separada por escola; não executar nesta PR |

### Regra de actualização

Actualizar este painel após cada lote, com SHA exacto, URL dos jobs, resultado e limites de evidência; manter relatórios técnicos como anexos. Não fechar gate com CI sintético, não alterar o ledger para fazer contagens coincidir, e não restaurar grants ou activar escolas com base neste painel. A matriz P01–P17 abaixo permanece a referência para evidência oficial.

Base main: 4e9ef8d6dae5b0f05382ac8ba170ec0d61d8f32b.
Origem recuperada: PR #193, commit cda2b63ead1fd2d8680fa3f357fd24cf8430ea6e (módulos puros de #185/#186). Cinco blobs preservados integralmente. Não importar a cadeia empilhada #118–#131 ou #137 em bloco. #126/#128/#129/#130 foram integradas na branch BILL-010, não demonstram presença em main.

## Regra inviolável de execução
- Nenhuma escola, incluindo Curtume, pode ter o motor fiscal activado antes de certificação AGT verificável e autorização separada.
- Preservar fiscal_escola_bindings.fiscal_enabled=false, freeze de emissão e ACL de RPCs críticas; nenhum GRANT, alteração RLS, migração, replay, KMS, série real, comunicação AGT ou deploy de produção nesta etapa.
- Recibos operacionais, propinas, bolsas, pagamentos e estornos actuais permanecem inalterados. Módulos recuperados não têm consumidores runtime novos; o motor decimal4/engineDeterministico existente não é substituído.
- Esta PR não resolve paridade SQL, não demonstra homologação nem autoriza merge de runtime fiscal. CI verde dos módulos puros não equivale a certificação.

## Base normativa a verificar e arquivar
DP 71/25 (Regime Jurídico das Facturas); DE 74/19 (validação de software); DE 317/20 (SAF-T AO, verificar vigência e articulação com diplomas posteriores); DE 683/25 (facturação electrónica). Portal oficial: https://portaldoparceiro.minfin.gov.ao/ (Schema 2, contratos, assinaturas e códigos); QR: https://portaldoparceiro.minfin.gov.ao/doc-agt/doc-agt/2/qrcode.html . Obter ofício original 0000498/01180000/AGT/2026 e confirmar prazo/processo administrativo; matriz interna não substitui original. Confirmar âmbito software de facturação (F), sem afirmar contabilidade completa nem autofacturação não oferecida.

## Evidência e discrepâncias
Snapshot anterior da auditoria 24/11: 786 migrações registadas; 2 vínculos fiscais, ambos desactivados; 20 tabelas fiscais/alocação com RLS ligada; EXECUTE negado a anon/authenticated/service_role para emitir documento, emitir recibo, finalizar assinatura e reservar número. Não é prova de paridade ou de isolamento integral. #308 contém números históricos desactualizados: novo inventário por versão/hash/definição/ACL necessário. Não executar db push/repair ou reproduzir SQL antigo para fazer o inventário coincidir.
Na main auditada: decimal.ts, agtCertificationPlan.ts, workflow fiscal-certification.yml, rotas de submit/provisioning originais ausentes. saftAo.ts usa hash_control em Hash e HashControl, e Number em FX. Adaptador financeiro colapsa cliente identificado sem NIF. PDF fiscal sem QR identificado. Verificar semântica dos campos e do material criptográfico persistido antes de corrigir (não reescrever histórico). Plano P11 exige confirmar duas guias de remessa, não presumir GR+GT suficiente; P13 N/A é apenas candidato; P15 inclui FR/RE e demais tipos efectivamente oferecidos.

## Matriz de execução
| Ponto | Evidência de aceitação | Estado |
|---|---|---|
| P01 | FT cliente com NIF real de homologação | Pendente |
| P02 | PDF antes/depois, anulação, motivo e XML; distinguir anulação local e AGT | Pendente |
| P03 | PP conferência | Pendente |
| P04 | FT a partir de PP, OrderReferences | Pendente |
| P05 | NC a partir de FT, References/Reason e limite cumulativo | Pendente |
| P06 | Duas linhas, IVA e isenção legal | Pendente |
| P07 | 100 x 0,55, desconto linha 8,8% e global; DB/PDF/XML/JSON | Pendente |
| P08 | FX, totais por moeda e AOA, câmbio | Pendente |
| P09 | Cliente identificado sem NIF, <50 AOA, antes das 10h reais de Luanda | Pendente |
| P10 | Segundo cliente identificado sem NIF | Pendente |
| P11 | Duas guias de remessa conforme ofício | Pendente |
| P12 | Orçamento ou PP conforme ofício | Pendente |
| P13 | Âmbito GF/autofacturação: exemplo ou N/A formal aceite | Pendente |
| P14 | FG se suportada | Pendente |
| P15 | Outros tipos suportados (incluindo FR/RC/ND/RE se aplicável) | Pendente |
| P16 | Índice ponto → IDs, número, PDF, XML, checksum, resultado | Pendente |
| P17 | SAF-T consolidado, dois períodos reais, XSD+semântica+assinatura; nenhuma omissão | Pendente |

## Gates em ordem
- [ ] A. Inventário actual main vs ledger remoto; comparar versões, hashes, funções/triggers/RLS/grants, recuperar proveniência e replay PostgreSQL 17 descartável com pg_cron; manter freeze.
- [ ] B. BILL-001–005: provar bloqueio de UPDATE/DELETE/TRUNCATE directos em documentos/linhas/eventos, numeração concorrente e rollback, tenant e série, cinco negativos originais; testar service_role também.
- [ ] C. BILL-007/009/010: ledger append-only, reversão idempotente, pagamentos parciais/lote, bolsas, descontos, regras tributárias versionadas e não mutáveis após emissão, arredondamento exacto, NC/ND/RC/rejeições.
- [ ] D. SAF-T: Hash=assinatura, HashControl=versão conforme origem/regra oficial, snapshot canónico, identificação cliente, referências, totais/FX, XSD oficial + validação semântica; PDF QR e menções. Não fabricar assinatura/versão ou certificado. Testes golden e comparação tripla.
- [ ] E. AGT Schema 2: contratos e JWS, separação chaves produtor/contribuinte, provisão de séries, outbox, estado/rejeição, contingência, retry seguro; testes offline com transport double e sem segredos.
- [ ] F. Runner P01–P17: dry-run default; vincular preflight a empresa, ambiente, versão e ano, janela Luanda, impedir replay incerto, manifesto e hash; ambiente isolado e aprovação separada para HML. Não filtrar transacções estatutárias de um SAF-T de período.
- [ ] G. Dossiê administrativo: confirmar original do ofício, prazo, Modelo 8/chave pública, retenção, backup/restauro, versões, processo e comprovativo de aceitação. Somente então propor activação em escola individual por aprovação separada.

## Etapa 1
Recuperação dos dois módulos puros, testes existentes e workflow específico de #193; execução inicialmente pendente, posteriormente PASS no snapshot acima. Aritmética não integrada ao runtime e sem alteração de guard fiscal global. Os testes históricos têm escopo limitado: adicionar limites de precisão/expoente, sinais, arredondamento e validação de transporte antes de integrar consumidores. Nenhum ponto P01–P17 deve ser declarado encerrado com testes sintéticos.

### Hardening adicional nesta branch
Limites de entrada/expoente/escala para evitar alocação descontrolada; validação round-trip do número JSON, rejeição de inteiros JS inseguros, testes de sinais/divisão/limites. P11 conserva GR (duas amostras a demonstrar); P15 explicita FR e inventário restante. As restrições técnicas de recursos não são limites legais de valores. CI de módulos puros aprovado no snapshot acima; não alterar contratos financeiros até validar schemas e integração.

## Inventário de versões (consulta de leitura, 24/11)
Árvore Git de main 4e9ef8d6dae5b0f05382ac8ba170ec0d61d8f32b, pasta supabase/migrations, sem truncamento; somente blobs cujo nome corresponde a timestamp de 14 dígitos e extensão SQL. Comparação com SELECT version,name,statements IS NOT NULL FROM supabase_migrations.schema_migrations; nenhum conteúdo SQL remoto foi publicado.

| Medida | Total |
|---|---:|
| Ficheiros versionados / versões únicas na main | 1019 |
| Versões remotas | 786 |
| Versões comuns | 687 |
| Somente main | 332 |
| Somente remoto | 99 |
| Somente remoto com nome BILL/fiscal/AGT/SAFT | 59 |
| Somente main com nome BILL/fiscal/AGT/SAFT | 1 |
| Versões comuns com nome diferente | 86 |
| Entradas remotas sem statements (NULL) | 90 |

Classificação por nome é aproximação, não prova de ausência/presença de objectos nem de equivalência. Não usar estes totais para reparar ledger. O freeze remoto 20261026105253_freeze_unhomologated_fiscal_issuance_20261026 e o ficheiro local 20271026121500_freeze_unhomologated_fiscal_issuance são versões distintas; comparar conteúdo/ACL/catálogo antes de decidir a proveniência. Gate A continua aberto. As 59 entradas incluem a cadeia BILL-001 a BILL-010, chaves, contingência, outbox e freeze; não importar sem prova de conteúdo e replay em ambiente descartável.
