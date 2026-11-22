# KLASSE — conciliação de 14 PRs históricas com a main

Base verificada: `c0eb2864be1c9e16492541a719bad7aec48fa4c8` (merge da PR #309).
Data da revisão: 30/10/2026, hora de Angola/Brasil não usada como contrato de calendário.

**Política:** esta conciliação não promove nem reexecuta 14 branches antigas. A unidade
de integração é o código actual da main; os patches antigos só são reaproveitados
quando existe um requisito funcional comprovadamente em falta, após testes e
revisão dos contratos canónicos. Nenhum dado de aluno, recibo, pagamento,
migração fiscal ou calendário oficial foi escrito nesta operação.

## Inventário e decisão por PR

| PR | Intenção histórica | Evidência na main verificada | Decisão de integração |
| --- | --- | --- | --- |
| [#236](https://github.com/moxi-edtech/moxi-edtech/pull/236) | Continuidade de sessão/explorador | `explorer-return-context.ts` compara utilizador, escola, polo, ano e portal; tem TTL, limite de vistas e invalidação. `CommandPalette.tsx` reutiliza retorno e limpa contexto | **Não cherry-pick**: preservar implementação posterior, testar scopes e seleção |
| [#237](https://github.com/moxi-edtech/moxi-edtech/pull/237) | Pesquisa server-side/keyset | `useExplorerRoster.ts` usa `useInfiniteQuery`, debounce, abort e ano; rota `command-center/roster` chama `command_center_roster_operational_v1` com escola autorizada; migração antiga `20271022130500_command_center_roster_keyset.sql` já existe na main | **Não cherry-pick/replay de SQL**: usar RPC operacional actual; ainda precisa EXPLAIN e JWT E2E antes de mudanças |
| [#238](https://github.com/moxi-edtech/moxi-edtech/pull/238) | Alertas, continuidade e exportação | Rotas `roster/export`, `roster-export-policy`, `ExplorerRosterExportButton`; exportação desactivada por padrão, CSV neutraliza fórmulas, auditoria precede entrega | **Não cherry-pick**: actual reforça isolamento e auditabilidade; exportação não deve ser activada sem política por escola |
| [#200](https://github.com/moxi-edtech/moxi-edtech/pull/200) | Dashboard editorial do aluno | `DashboardLoader.tsx`, `dashboardPresentation.ts` e testes `aluno-dashboard-editorial.spec.ts` já presentes; dashboard evita carregar bloqueios do boletim como condição do primeiro paint | **Não cherry-pick**: versão actual é mais recente |
| [#201](https://github.com/moxi-edtech/moxi-edtech/pull/201) | Notas por período / controlo de pagamento | `TabNotas.tsx`, `gradesPresentation.ts`, `BoletimGradeGrid` e `ServicePaymentDrawer`; notas são descartadas se `json.is_liberado` não for `true`; escola, matrícula e ano devem continuar protegidos também no servidor | **Não cherry-pick**: versão actual inclui estados e pagamentos mais recentes; testar E2E |
| [#202](https://github.com/moxi-edtech/moxi-edtech/pull/202) | Aviso partilhado em Rematrícula e Financeiro | `Notice` já existe em `components/ui/alert.tsx`; `RematriculaBanner` e `FinanceAlertBanner` utilizam-no | **Coberto**; manter regras de pagamento fora do componente de UI |
| [#203](https://github.com/moxi-edtech/moxi-edtech/pull/203) | Avisos editoriais no Alert | O `Alert` mantém compatibilidade e exporta `Notice` | **Coberto**; não recriar contrato paralelo |
| [#204](https://github.com/moxi-edtech/moxi-edtech/pull/204) | `ui/notice.tsx` e avisos recentes | `AvisosRecentesCard` já usa `Notice` de `ui/alert.tsx`; `ui/notice.tsx` não existe na main | **Não cherry-pick**: evitar segundo componente divergente |
| [#181](https://github.com/moxi-edtech/moxi-edtech/pull/181) | Ano de destino calculado de templates/ano activo | `sessions-target/route.ts` delega para `prepareCanonicalMedCalendar`, `calendarios_oficiais_anos` e exige seleção de calendário oficial; o helper antigo `target-academic-year.ts` está ausente. Na PR antiga, `resolveTargetAcademicYear` usa `Math.max(templateBaseYear, activeYear + 1)`, que pode desalinhar `ano_base` do calendário MED (ex.: 2026/2027) | **Não reutilizar helper antigo**; validar apenas cronologia/data da fonte oficial com cenários do decreto e duas escolas |
| [#116](https://github.com/moxi-edtech/moxi-edtech/pull/116) | Auditoria de prontidão Calendar Intelligence V0.1 | Documento datado de 04/08/2026; a actual main já contém calendário canónico MED, perfis e transacções posteriores | **Arquivo histórico**: não promover o documento como estado actual; atualizar só se for revalidado |
| [#184](https://github.com/moxi-edtech/moxi-edtech/pull/184) | Etiqueta não-fiscal e replay de outbox com prova | O script da PR é condicionado a `event_id`, `owner_approval`, classificação e referência de evidência; a sua prova de não-entrega depende de verificação externa, não do SQL. O snapshot de 12/10 não prova o estado actual | **BLOQUEADO** para replay: nenhuma execução. Etiqueta só com proveniência verificável de recibo operacional; não activar o booleano globalmente |
| [#182](https://github.com/moxi-edtech/moxi-edtech/pull/182) | Importação 61 migrations e histórico fiscal | Inventário de 11/10 com 624 entradas remotas já está obsoleto face ao ledger operacional reconciliado posteriormente com 702 entradas (30/10). PR toca 86 ficheiros, incluindo SQL BILL/AGT e colisões | **BLOQUEADO**: não importar, marcar como executado, modificar timestamps ou fazer db push; conciliar contra ledger actual na [Issue #308](https://github.com/moxi-edtech/moxi-edtech/issues/308) |
| [#124](https://github.com/moxi-edtech/moxi-edtech/pull/124) | Hotfix de recibos em SHA de produção antigo | As páginas `secretaria/pagamentos/[pagamentoId]/recibo/print` e `OperationalPaymentReceiptDocument` da PR não existem na main. O fluxo corrente usa `documentos_emitidos`, consulta por pagamento/lote e documentos imprimíveis por ID | **Não cherry-pick**: teria risco de regressar a impressão não autorizada / endpoints legados |
| [#123](https://github.com/moxi-edtech/moxi-edtech/pull/123) | Desacoplar recibo operacional do fiscal | Mesma família de mudanças de #124 sobre outra base antiga; main tem rota `recibos/consultar` com `escola_id`, `aluno_id`, pagamento e recuperação consolidada; Balcão mantém RPC de registo de pagamento e emissão de recibo independente | **Não cherry-pick**: auditar divergências reais pelo fluxo actual, não restaurar camada antiga |

## Contrato a preservar no código presente

1. **Command Center:** contexto efémero só entre a mesma identidade, tenant, polo, ano e portal; pesquisa do servidor usa autorização e guard de polo; exportação desactivada até política explícita e auditoria confirmada antes de qualquer CSV.
2. **Portal do aluno:** só uma superfície `Notice`; pagamento pendente nunca implica novo débito; notas escondidas no cliente *e* nas APIs quando o documento não está liberado; o boletim segue o ano/matrícula.
3. **MED/virada:** o decreto e calendário publicado são fonte do ano, períodos e eventos por oferta; não usar `ano ativo + 1` sem fonte; não sobrescrever calendários divergentes.
4. **Recibos:** pagamento liquidado e recibo emitido são estados independentes; recuperar por `pagamento_id`/chave do lote, limitado a escola/aluno, inclusive após fechar modal e recarregar; não activar engine AGT nem repetir lançamento financeiro.

## Teste automático acrescentado

`scripts/ci/legacy-pr-reconciliation.contract.test.mjs`, executado por
`.github/workflows/legacy-pr-reconciliation-guard.yml`:
- confirma os contratos de escopo/roster/exportação no Command Center;
- verifica fonte única `Notice`, publicação de notas e componente de pagamento;
- recusa regressão do endpoint de virada para o helper legado;
- exige idempotência e recuperação de recibos por escola/aluno/pagamento.

Os testes são **de contrato de fonte** (não exercitam JWT real, RLS remoto,
inserção nem UI num browser); são um guard de regressão, não homologação.

## Gates antes de integrar alterações funcionais adicionais

- Checks GitHub verdes no HEAD da PR de conciliação.
- Revisão de equivalência dos requisitos novos com os existentes, sem duplicar
  frontend, endpoints ou migrations; testes focados e regressões transversais.
- Command Center: E2E de identidade/tenant/polo/ano, exports com configuração
  explícita e auditoria que falha fechada, benchmark do roster.
- Aluno: PDF e JSON com dois tokens autenticados, dados de anos distintos,
  pagamento em análise/rejeitado, nenhuma nota no payload não autorizado.
- MED: sincronização real da fonte oficial do ano 2026/2027, ofertas, três
  trimestres, virada em duas escolas e rollback em falha transaccional.
- Recibos: pagamento liquidado vs emissão pendente, retomada idempotente e
  consulta persistente, sem efeitos fiscais ou duplicação.
- Migrações #182: comparar SQL local e remoto literal/por versão;
  classificar os 67 remotos-only e 306 locais-only ainda em aberto, com
  especial cuidado para BILL/AGT. Os números são o inventário anterior, não
  certificação de um novo cálculo integral.

## Decisão de release

A PR criada por este relatório é **elegível para revisão e merge apenas do
inventário e do guard de regressão**, após CI. Isso **não** torna as 14 PRs
originais integráveis nem autoriza a promoção da sua lógica antiga.

Não foi feito merge para main, alteração de banco, replay de recibos ou deploy
no âmbito desta reconciliação.
