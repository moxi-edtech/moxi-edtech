# Command Center / Balcão — estado verificado e backlog de homologação

**Data de corte:** 22/10/2026 · **Estado:** implementação em revisão; **não homologado**, **não integrado**, **não publicado**.  
**Repositório:** `moxi-edtech/moxi-edtech` · **Fonte desta actualização:** código e GitHub Actions nos HEADs abaixo.  
**Padrão normativo:** [Graciosidade no KLASSE](../product/graciosidade.md): contexto → estado → acção segura → resultado comprovado → próximo passo → recuperação.

> **Importante:** «CI verde» significa que os workflows **configurados** passaram naquele commit. Não significa que o fluxo completo esteja pronto, que as policies reais tenham sido testadas ou que uma migration esteja instalada. Os PRs continuam **draft**; merge, deploy e mudanças de produção não foram autorizados.

## 1. Estado auditável das PRs

| Frente | PR / HEAD conferido | CI no próprio HEAD | O que a CI prova | O que não prova |
| --- | --- | --- | --- | --- |
| Base: exploradores | [#234](https://github.com/moxi-edtech/moxi-edtech/pull/234) · `33a4764` | 7/7 sucesso | Contratos, navegação, guarda de pesquisa e integração estática | Homologação real, migrations aplicadas |
| **P0 — sessão, autorização, retorno** | [#236](https://github.com/moxi-edtech/moxi-edtech/pull/236) · `38c47fa` | **6 sucessos / 1 falha** | Contratos e regressões parciais | Replay integral de migrations e RLS reais |
| **PR 2 — pesquisa e keyset** | [#237](https://github.com/moxi-edtech/moxi-edtech/pull/237) · `bc1700d` | **7/7 sucesso** | Inclui PostgreSQL com 55 registos fictícios, cursor, acentos, entrada maliciosa e escola distinta | Polos canónicos e regras de filtros não definidas |
| **PR 3 — contexto, alertas, exportação** | [#238](https://github.com/moxi-edtech/moxi-edtech/pull/238) · `61267c6` | **6/6 sucesso** | Typecheck, testes e regressões dos ficheiros abrangidos | Permissões de exportação homologadas; auditoria em RLS real |
| **PR 4 — SQL, observabilidade, browser** | [#239](https://github.com/moxi-edtech/moxi-edtech/pull/239) · `26b3c4b` | **12/12 sucesso** | Testes SQL descartáveis, contratos, browser com fixtures e artefactos; **não** E2E Auth real | Performance de produção e garantia de zero aumento de pedidos/hora |

**Evidência principal:** [replay P0 falhado](https://github.com/moxi-edtech/moxi-edtech/actions/runs/39811867508); [keyset SQL passou](https://github.com/moxi-edtech/moxi-edtech/actions/runs/39810473705); [SQL de desempenho passou](https://github.com/moxi-edtech/moxi-edtech/actions/runs/39812302860); [capturas Playwright passaram](https://github.com/moxi-edtech/moxi-edtech/actions/runs/39812303330).

**Atenção ao empilhamento:** os HEADs das branches inferiores foram actualizados **depois** de as branches superiores serem criadas. Em particular, as bases registadas nas PRs #237, #238 e #239 não acompanham os últimos commits respectivos de #236, #237 e #238. **É obrigatório reconciliar/reempilhar e voltar a executar a CI no HEAD de cada PR**, sem realizar merge na `main`.

## 2. O que existe no código — sem confundir com aceite funcional

- **#234:** abertura e navegação nos exploradores, retorno Turma/Classe ↔ Balcão, página/scroll/aluno, pesquisa mobile, breadcrumbs, capacidade e vagas, recentes em memória, estado de erro e «Carregar mais».
- **#236:** snapshot temporário com utilizador, escola, polo (obtido da URL), ano letivo e portal; invalidação em mudanças de sessão; cancelamento de pesquisas obsoletas; aviso se o aluno seleccionado não aparecer na página recuperada; limites de cache. **Página ausente não prova que o aluno foi transferido/trancado**.
- **#237:** consulta SQL de alunos com `SECURITY INVOKER`, nome/número normalizados, pesquisa antes da paginação, desempate por identificador, cursor, tamanho máximo e contagem filtrada; UI de Turma/Classe com debounce e retry. **Filtro canónico actualmente exposto:** matrícula activa; ordenação: nome A–Z. Os chips de documentação/financeiro estão indisponíveis, não são filtros prontos.
- **#238:** guarda da posição de navegação; sobrelotação com fonte verificável; contrato de exportação CSV mínimo, neutralização de fórmulas, limite e auditoria obrigatória **com exportação desactivada por omissão**. As seis acções contextuais por capacidade/permissão ainda carecem de prova ponta a ponta.
- **#239:** resumo de Classe no PostgreSQL em vez de carregar até 3.000 matrículas em lotes de 500; IDs de correlação nos cinco endpoints contextuais; limite de memória; suite sintética de **5 resoluções × 3 escalas × 9 estados (135 capturas)**, utilizando o componente real de Turma com endpoints simulados, **não o Balcão real autenticado**.

**Evolução do requisito, ainda incompleta:** a Secretaria deve localizar e operar sobre o **universo completo** por Turma e Classe; a versão presente ainda **não** inclui a combinação homologada de filtros documental/matrícula/financeiro, ordenação de pendências e acções por permissão.

## 3. Blocker comprovado do replay histórico (P0)

No workflow de Supabase **desligado de qualquer projecto**, o arranque em PostgreSQL 17 e início do replay aconteceram. A execução [39811867508](https://github.com/moxi-edtech/moxi-edtech/actions/runs/39811867508) falhou na migration preexistente:

```text
20260202011000_backfill_pagamentos_aluno_id.sql
SQLSTATE 42703: column p.aluno_id does not exist
UPDATE public.pagamentos AS p SET aluno_id = m.aluno_id
FROM public.mensalidades AS m WHERE p.aluno_id IS NULL;
```

O erro antecede as migrations propostas para o Command Center. **Não** prova defeito nas novas migrations, mas impede provar que toda a história e as RLS reais se instalam correctamente a partir do zero. O teste PostgreSQL de fixture que passa **não cobre** todas as migrations instaladas no projecto.

**Política de correcção:** verificar, em **leitura**, o catálogo/histórico de migrations efectivamente instalados, construir uma baseline estrutural fiel num ambiente descartável e reconciliar o ponto de origem com PR independente. Não editar migrations já aplicadas, não criar remendo retroactivo que altere a verdade de produção, não tocar na base de produção.

## 4. Backlog priorizado

Estados usados: **Pendente** (não concluído); **Parcial** (há implementação, falta requisito/prova); **Decisão** (depende da regra de negócio). As prioridades são de aprovação do produto, **não uma autorização automática para merge**.

| ID | Prioridade | Backlog e critério de aceite | Estado | Dependência / referência |
| --- | --- | --- | --- | --- |
| **CC-001** | **P0** | Reconstruir **todas** as migrations e policies reais numa réplica estrutural descartável; documentar origem, divergências, apply/reapply/rollback seguro, dois replays limpos e regressões SQL, sem alterar ficheiro já aplicado. | **Bloqueado — falha reproduzida** | Migration `20260202011000`; #236; baseline actual verificada |
| **CC-002** | **P0** | Autorização **na base** por Admin Geral, Director, Secretaria e papel negado: escola A nunca lê B; tentativas de leitura e escrita negadas; verificar a migration da #234 sem enfraquecer RLS ou fiscal. | **Parcial** | CC-001, #234, #236 |
| **CC-003** | **P0** | Modelo canónico de **polos**: provar vínculo operador↔polo↔turma/matrícula no DB e aplicar a todas as consultas e caches; se ausente, **negar** em vez de mostrar alunos de outro polo. E2E dois polos. | **Bloqueado — relação canónica não demonstrada** | Decisão de modelação/autorização |
| **CC-004** | **P0** | E2E com GoTrue/contas fictícias criadas pelos testes: **3 atendimentos seguidos**, dois utilizadores/escolas/polos, todos os perfis, sessão expirada e rascunho preservado; sem dados reais nos artefactos. | **Pendente** | CC-001–003, #213/#236 |
| **CC-005** | **P0** | Revalidar retorno após **transferência, cancelamento, trancamento ou eliminação** consultando pertença/estado canónicos: diferenciar aluno fora da página de aluno efectivamente fora da turma, limpar selecção inválida e explicar próximo passo. | **Parcial** | #236, permissões de leitura |
| **CC-006** | **P0** | Reconciliar PR **#235** e conflitos dos ficheiros partilhados com **#213/#216**, fluxo de IA e guarda financeira **#232**; **reempilhar #237→#238→#239** sobre os HEADs actuais, preservar rascunhos, CI verde final de cada um. | **Pendente — stack defasado** | #234–#239; sem merge |
| **CC-007** | **P0** | Demonstrar ausência de fuga de contexto no logout/expiração, incluindo cache React Query, recentes, retorno, formulário e sessão; retorno ao login sem perda silenciosa de rascunho. | **Parcial** | #236, #213; CC-004 |
| **CC-008** | **P1** | Definir por escola os estados canónicos de **documento em falta** e **matrícula incompleta**; só habilitar filtros quando regra + consulta SQL + teste de permissão existirem; manter indisponíveis com explicação até lá. | **Decisão + implementação** | Produto, #237 |
| **CC-009** | **P1** | Implementar pesquisa/filtros combinados e **ordenação operacional** («pendências primeiro» somente se estado válido), com cursor estável, desempate por ID, total exacto e testes sem duplicações/omissões. | **Parcial** | CC-008, #237 |
| **CC-010** | **P1** | Homologar filtro de **pendência financeira** sobre dívida canónica; nunca interpretar «aprovado pela Secretaria» como «liquidado». Testar concessão/negação com casos sintéticos. | **Decisão + implementação** | Contratos fiscais/financeiros inalterados; #232 |
| **CC-011** | **P1** | Acções directas **Matrícula, Rematrícula, Pagamentos, Documentos, Perfil e Notas** com aluno/ano certos, navegação à operação existente, capacidade do papel e razão de indisponibilidade; Nova Matrícula continua independente. | **Parcial** | #238, integração com #213 |
| **CC-012** | **P1** | As cinco vistas preservam filtros, ordenação, página, scroll e foco quando se navega e regressa; testar teclado, histórico de navegação e mudanças de escola/polo/ano. | **Parcial** | #238; CC-003/004 |
| **CC-013** | **P1** | Exportação/impressão por regra **por escola e perfil**, disabled-by-default, confirmação de finalidade, auditoria persistida de cada exportação, RLS, limite, rodapé e CSV sem fórmulas; teste negar por falha de auditoria. | **Parcial / decisão** | #238; CC-002; questão de negócio abaixo |
| **CC-014** | **P1** | Rate limiting no servidor por operador/escola e validação de termos, incluindo abuso, ataques com curingas e múltiplas buscas; medir quota gratuita. Não basta só debounce no cliente. | **Parcial** | #237; CC-002 |
| **CC-015** | **P1** | Comparar índices e `EXPLAIN (ANALYZE, BUFFERS)` nas consultas reais em réplica fiel; validar migrações novas, diferenças por cardinalidade e reexecução segura. | **Parcial: EXPLAIN de fixture existe** | CC-001, #237/#239 |
| **CC-016** | **P1** | Medir **antes/depois** p50/p95, tamanho das respostas e requisições/hora no **mesmo ambiente**, com script e fixtures equivalentes; provar que não há aumento de requisições/hora no cenário de uso real. | **Pendente (modelo sintético existe)** | #239, docs/performance |
| **CC-017** | **P2** | Padronizar correlação/erros também nos endpoints auxiliares, incluindo pesquisa de disciplinas e exportação, mantendo logs sem identificadores ou nomes de menores. | **Parcial: cinco endpoints** | #239 |
| **CC-018** | **P2** | Acessibilidade **WCAG AA**, teclado, foco restaurado, leitores de ecrã, zoom nativo, sem scroll horizontal/aninhado desnecessário nas cinco vistas. | **Parcial: visual sintético aprovado** | #239, Playwright |
| **CC-019** | **P2** | Homologar capturas, em **cada PR**, para lista, resultado, filtro, vazio, erro, carregamento, 55/50/5, retorno real de Balcão, nas 5 dimensões × 3 zooms; distinguir story sintética de E2E completo. | **Parcial: 135 capturas sintéticas na #239** | #239; CC-004 |
| **CC-020** | **P2** | Ensaiar sessão longa (dia de atendimento), limites do cache, memória/heap, retentivas de formulários e ausência de polling acrescido. | **Parcial: limites em código, não ensaio longo** | #213, #216, #239 |

**Ordem de execução:** CC-001 → CC-002/003 → CC-004/005/007 → CC-006 (reempilhar depois das correcções) → CC-008/009/010/011/012/013/014 → CC-015/016 → CC-017/018/019/020. Actividades não dependentes podem ser preparadas em paralelo, nunca promovidas prematuramente.

## 5. Perguntas exactas de produto — não inventar regras

1. **Exportação:** «Para cada escola, quais os perfis autorizados a exportar listas de alunos, para que finalidade, com que limite de linhas e período de retenção de auditoria? A regra muda entre Turma, Classe e ano histórico?» **Até resposta:** `enabled=false`.
2. **Documentos:** «Que documentos são obrigatórios por tipo de aluno, nível/curso, matrícula e escola? Em que momento o documento conta como em falta: não enviado, devolvido ou por validar?» **Até resposta:** filtro inactivo.
3. **Matrícula incompleta:** «Quais os estados do contrato académico que definem incompleta, incluindo rematrícula condicional, recurso e extraordinário?» **Até resposta:** não derivar indicador novo.
4. **Pendência financeira:** «Que dívida canónica autoriza exibir pendência e a que data de corte, diferenciando pagamento registado, comprovativo aprovado e valor liquidado?» **Até resposta:** não usar heurística.
5. **Polos:** «Qual é a relação canónica entre utilizador, polo e matrícula/turma — e que perfis podem consultar vários polos?» **Até resposta:** falha fechada.

## 6. Evidências e comando de revisão — sem acesso de escrita a produção

```bash
# GitHub, apenas leitura; cada HEAD deve ser rechecado após novo commit.
gh pr view 236 -R moxi-edtech/moxi-edtech --json headRefOid,baseRefOid,isDraft,mergeable
gh pr checks 236 -R moxi-edtech/moxi-edtech
gh pr checks 237 -R moxi-edtech/moxi-edtech
gh pr checks 238 -R moxi-edtech/moxi-edtech
gh pr checks 239 -R moxi-edtech/moxi-edtech
gh run view 39811867508 -R moxi-edtech/moxi-edtech --log-failed

# Análise controlada de fixture; usa Docker/Postgres DESCARTÁVEL na CI.
# Não executar qualquer db push, migration up ou deploy ligado à produção.
node apps/web/scripts/performance/command-center-request-budget.mjs --enrollments=3000 --views=20 --searches=20
```

**Gates exclusivos do proprietário:** (1) definir as cinco regras de negócio acima; (2) aprovar plano de baseline e permissões reais após revisão; (3) aprovar separadamente aplicação de migrations e qualquer merge/deploy, depois de E2E, performance e segurança comprovados. **Este documento não concede tais autorizações.**

## 7. Documento de apoio

- [P0 — segurança e replay](pr1-security-continuity-gates.md) (a versão mais recente vive na branch da #236 até reempilhar).
- [PR 3 — exportação por política](pr3-actions-export-decisions.md).
- [PR 4 — medições e evidências](../performance/command-center-20261022.md).
- [Baseline de graciosidade](../product/graciosidade.md).
- Trabalhos relacionados: [Balcão desempenho #213](https://github.com/moxi-edtech/moxi-edtech/pull/213), [nice-to-haves #216](https://github.com/moxi-edtech/moxi-edtech/pull/216), [guarda financeira #232](https://github.com/moxi-edtech/moxi-edtech/pull/232) e [reconciliação UX #235](https://github.com/moxi-edtech/moxi-edtech/pull/235).

**Definição de pronto final:** quatro PRs com CI verde no HEAD reempilhado, testes Auth/RLS fiéis ao modelo, capturas com fixtures, desempenho/quotas comprovados, conflitos reconciliados, regras de negócio decididas e revisão humana. **Não confundir o número de commits ou checks com a conclusão do produto.**
