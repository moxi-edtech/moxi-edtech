# RAA ↔ Balcão — resolução no mesmo atendimento

Branch: feat/balcao-raa-contextual-resolution-20261029 (empilhada sobre a PR #296).

## Contrato
- Preservar aluno, matrícula de origem e rascunho financeiro durante a resolução.
- Mostrar apenas ações compatíveis com o bloqueio devolvido pelo RAA.
- Lançamento de notas: reutilizar EnrollmentPostActionModal e API de notas com guardas de período, escala e competência.
- Reapreciação: consultar/criar/decidir pedidos via APIs existentes; deferir não significa aprovação académica.
- Faltas: decidir justificações enviadas pelo encarregado; a aprovação não modifica frequência original nem levanta automaticamente retenção.
- Indisciplina: a direção deve documentar revisão, sem desfazer sanções silenciosamente.
- Conclusão de ciclo: ir ao separador de documentos, nunca rematricular automaticamente.
- Após cada ação, voltar à mesma ficha, reconsultar RAA e abrir rematrícula apenas se a API confirmar elegibilidade.
- Não alterar matrículas.status, historico_anos, financeiro, fiscal ou AGT para contornar bloqueios.

## Homologação necessária
1. Testar roles de secretaria/direção/professor e anos históricos.
2. Conciliar justificações aprovadas com assiduidade oficial (a API atual mantém falta original).
3. Integrar resultados de exames extraordinários/recurso à publicação oficial do resultado, sem atalhos.
4. Testar contexto do aluno, abas, rascunhos e concorrência de sessões.
5. Validar Supabase v3 da PR #296 antes de merge/deploy.

## Resultados acrescentados nesta branch
- O Balcão consulta sessões oficiais de recurso e extraordinário no ano letivo da matrícula de origem; lança uma nota por componente e aluno através do endpoint canónico. Sem sessão oficial aberta, mostra a pendência, sem simulá-la.
- A API de exames exige aluno, turma, ano de origem, componente da sessão, escala, matrícula ativa e sessão aberta/publicada. Lançamentos existentes não são substituídos: repetição idempotente da mesma nota ou conflito se houve alteração.
- As justificações formalmente aprovadas passam a deixar de contar como faltas **injustificadas** no resolvedor jurídico do decreto (somente por `frequencia_id` idêntico). A frequência original e a petição mantêm-se auditáveis e imutáveis.
- O fecho legal não pode ser alterado pela nota ou pela decisão de uma petição.
- O painel revalida a elegibilidade central após a decisão; nenhum pagamento é capturado antes de ela autorizar o destino.

## Limitações que ainda exigem homologação
- Verificar paridade exata entre o resolvedor PostgreSQL e o adaptador do decreto em TypeScript após justificações de faltas, incluindo percentuais EJA e turmas com várias disciplinas.
- Uma nota de exame `submetido` não equivale ao estado `validado` ou à pauta legal publicada. A interface não cria atalhos para essa decisão.
- Contextos históricos fechados exigem reabertura formal; a simples aprovação de pedido não reescreve histórico.
- Testes unitários e GitHub CI não substituem ensaio autenticado em banco real; dependência da PR #296 permanece.

## UI/UX contextual guiada (29/10/2026)
- Substituição do painel com formulários simultâneos por passos **Identificar → Resolver → Revalidar**. O indicador representa etapas da interface, não aprovação académica.
- Cartões representam somente evidências retornadas pelo RAA ou pedidos reais; o total e o número de decisões registadas não são inventados. Quando não existem pedidos, permanece uma orientação de bloqueio canónico.
- A ação é apresentada por contexto (justificação, recurso, sessão de exame, indisciplina, pauta, conclusão de ciclo). Uma pendência selecionada abre o seu formulário.
- Antes de qualquer escrita, há ecrã de revisão e confirmação; mensagens de confirmação distinguem **registo administrativo** de **autorização de rematrícula**.
- A interface adapta-se a móvel, usa tokens de tema light/dark e evita navegações externas. Os formulários reportam estado de rascunho ao Command Center, com proteção ao descartar entradas dentro da lista.
- Formulários continuam a usar os mesmos endpoints, idempotência e controlos de permissão, sem atualização manual de estados académicos.
- A UI da rematrícula autorizada continua exclusivamente no wizard existente. A experiência RAA bloqueada não adiciona um botão para ignorar a decisão.

### Validação não substituída
A UI pode mostrar apenas a situação prioritária que a API de rematrícula devolve nesse momento; não promete uma fila simultânea de todos os tipos de bloqueios sem evidências oficiais. A elegibilidade deve ser reconsultada após cada resolução antes de prosseguir. Homologação autenticada (mobile, roles, EJA, anos fechados) permanece obrigatória.

## Contextualização jurídica por classe e regime (PR #298)

**Fonte de verdade:** `resolveRaaProgressionForMatricula` retorna o regime académico da **matrícula de origem** e os factos de `resolveRaaDecretoEligibility`. A resposta `/api/secretaria/balcao/rematriculas/status` disponibiliza `academic.regime` e `academic.decreto` apenas como **informação de orientação**; o estado `status` e `academic.eligible` continuam exclusivos para autorização do wizard.

| Regime | Orientação contextual | Permissão de efetivar |
| --- | --- | --- |
| 6.ª | Recurso de conclusão do ensino primário / emissão documental | Só após decisão oficial e elegibilidade |
| 7.ª | Condicional com disciplinas por regularizar | Pode prosseguir se o decreto e serviço autorizam |
| 8.ª | Condicional antes da 9.ª | Bloqueia enquanto o decreto exige exame/regularização |
| 9.ª | Recurso e conclusão do I ciclo | Sem matrícula automática no próximo ciclo |
| 10.ª | Condicional e disciplinas específicas | Pode prosseguir se o decreto e serviço autorizam |
| 11.ª | Condicional antes da 12.ª | Bloqueia enquanto o decreto exige exame/regularização |
| 12.ª | Recurso e conclusão do II ciclo | Apenas documentação após conclusão |
| EJA módulos 1/2 | Classificação qualitativa e frequência anual | Depende de fonte oficial da avaliação |
| EJA módulo 3 | Conclusão qualitativa ou recurso numérico | Depende de fonte oficial e decisão do motor |
| EJA ano 1 | Condicional com exame extraordinário | Bloqueado quando o decreto exigir |
| EJA ano 2 | Recurso e conclusão | Sem conclusão automática |

A interface **não calcula notas, não avalia limites de disciplinas negativas e não interpreta combinações proibidas**. Exibe o `baseLegal`, a decisão do decreto e a orientação contextual; ausência de um resultado do decreto é representada como **não apurado**, nunca como autorização implícita. A 7.ª e 10.ª apresentam uma faixa informativa discreta na situação `READY` com condicional autorizado, sem novo CTA de cobrança/efetivação.

Para as matrículas com `regime.escala = qualitativa`, o Balcão **não oferece o lançamento de notas numéricas** como substituto de Suficiente/Não suficiente. A pauta qualitativa exige o fluxo de avaliação oficial correspondente.

### Lacunas levantadas com evidência

- **#300 — EJA qualitativo e frequência anual:** o `vw_boletim_por_matricula` expõe `nota_final numeric` e status de configuração/isenção; o `resolveDecretoDecision` atual passa apenas `notaFinal`, sem `suficiente` nem `frequenciaAnual`. A função jurídica EJA admite esses campos, mas não existem provas suficientes de integração EJA end-to-end para declarar homologação. Proibida conversão arbitrária de nota em classificação qualitativa.
- **#301 — 1.ª–5.ª classes:** o motor jurídico tipado abrange 6.ª–12.ª e EJA. O adaptador RAA devolve `null` fora desses regimes. Até definir o contrato legal, mostrar orientação conservadora e manter o bloqueio/regra oficial da API.
- **Homologação:** executar fluxos com autenticação por papel (secretaria, direção, professor), turma, classe, ano letivo e escola, incluindo registos antigos e EJA antes de publicar.

### Testes da matriz

`apps/web/tests/unit/raa-balcao-regime-guidance.spec.ts` valida a identificação de **12 regimes legais**, condicional autorizada versus bloqueada (7.ª/8.ª/10.ª/11.ª/EJA 1.º), recurso (6.ª/9.ª/12.ª), conclusão, EJA qualitativo e numérico, frequência anual, faltas trimestrais, indisciplina, falta de dados e ausência de decreto. O CI da PR também executa `raa-decreto-eligibility.spec.ts` como regressão do motor jurídico. A execução destes testes **não substitui** homologação autenticada e integração de fontes qualitativas.
