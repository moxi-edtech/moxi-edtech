# Command Center e Exploradores — estado atual (23/10/2026)

**Fonte de verdade para estado de integração e implantação.** Documentos datados de 22/10/2026 preservam o histórico da auditoria e dos critérios de aceite; não devem ser interpretados como estado atual da `main`.

## Integração e implantação verificadas

| Marco | Estado comprovado |
| --- | --- |
| [PR #252](https://github.com/moxi-edtech/moxi-edtech/pull/252) — consolidação do Command Center | **MERGED** em 23/10/2026, incluindo a cadeia de exploradores, autorização, pesquisas e gates CC |
| [PR #232](https://github.com/moxi-edtech/moxi-edtech/pull/232) — validação financeira idempotente | **MERGED**; migration financeira instalada |
| [PR #253](https://github.com/moxi-edtech/moxi-edtech/pull/253) — Workspace/Balcão (#211/#213/#216) | **MERGED** em 23/10/2026; **24/24 workflows verdes** no HEAD de integração `c4f833dec0497a52efe4a6fe0f675628d2071e46` |
| Vercel — KLASSE | Deployment `dpl_Hescz5xm8kzhJhNqnkDGZT7kWLmK` **READY**, origem `main` / merge `2028b1cc0cc0f3c1b228f93de6aa37eafdfabc32` |
| Supabase — Command Center | **11 migrations versionadas** aplicadas e conferidas no histórico de produção |
| Supabase — CC-003 | **0 escolas com polo enforcement ativo**; estrutura instalada **não** significa isolamento por polo ativado |
| Supabase — financeiro | Migration `20271015110000` instalada; assinatura e corpo de `financeiro_aplicar_pagamento_existente` preservados |

As verificações de GitHub, Vercel e Supabase foram efetuadas em 23/10/2026. O deployment READY demonstra que a build foi publicada, **não** que todos os percursos reais tenham sido homologados em sessões de Secretaria.

## O que o produto oferece hoje (implementado)

- **Cinco exploradores contextuais:** Curso, Classe, Turma, Professor e Disciplina. Pesquisa global abre o Command Center, com pesquisa e navegação contextual; a escolha do resultado deve respeitar o portal e as capacidades do operador.
- **Pesquisa operacional de alunos:** RPCs e controlos de roster com pesquisa antes da paginação, cursor determinístico, ordenação, filtros combinados condicionados a estados válidos e tratamento de erros correlacionados. Os filtros sem regra canónica aprovada **não** são considerados habilitados.
- **Continuidade de atendimento:** retorno contextual ao explorador, retenção de contexto limitada e invalidada ao mudar utilizador, escola, polo, ano ou portal; snapshots de navegação e tratamento de dados desatualizados. Um aluno ausente da página **não** é automaticamente aluno transferido.
- **Integração com o Balcão:** dossier contextual e ações encaminhadas para os fluxos existentes; a matrícula nova não reutiliza o aluno selecionado. A PR #253 reconcilia rascunhos, desempenho, atalhos, telemetria e o contexto modal sem substituir o motor financeiro.
- **Autorização e privacidade:** RLS e guards por escola, limitação de informações sensíveis em logs, capacidades revalidadas pelo destino e recentes efémeros. Exportação CSV requer política explícita por escola, auditoria e proteção contra fórmulas; **não presumir exportação habilitada**.
- **Observabilidade e acessibilidade:** IDs de correlação, testes de teclado, zoom, viewports e fixtures com dados fictícios. Não equivalem a homologação manual NVDA/VoiceOver.

## Limites e decisões ainda pendentes

1. **CC-003 — polo:** não ativar `cc_security.enforced_schools` sem vínculos canónicos operador/polo/turma, plano de reversão e homologação de todos os fluxos afetados (matrícula, transferência, finanças, portais). Zero escolas ativadas no corte acima.
2. **CC-001 / autenticação real:** não exigir replay cego de todas as migrations históricas contra produção. A instalação atual do Supabase é a referência para compatibilidade; validar GoTrue/RLS com contas fictícias e réplica estrutural fiel. Os workflows verdes são evidência de contrato e de fixture, não substituem esse ensaio.
3. **CC-008/010/013 — regras por escola:** confirmar obrigatoriedade documental, significado de matrícula incompleta e exportação autorizada antes de ativar opções correspondentes.
4. **Operação real:** executar smoke tests autenticados por papel/escola com cinco exploradores, seleção de aluno, ida ao Balcão, três atendimentos consecutivos, retorno com filtros/scroll, transferência, ano letivo, teclado e dispositivos.
5. **Desempenho e acessibilidade:** comparar p95/volume de pedidos em ambiente representativo; validar leitores de ecrã manualmente e observar erros da Vercel após o deploy.

## Onde está a especificação detalhada

- [Auditoria dos cinco exploradores](../command-center-exploradores-auditoria-20261022.md) — riscos, hipóteses, decisões de UX e critérios de aceite **históricos**.
- [Modal contextual](../command-center-contextual-modal.md) — comportamento de abertura, navegação e retorno.
- [Contratos CC-009 a CC-018](cc009-018-contratos-funcionais.md) — pesquisa, ações, sessão, observabilidade e acessibilidade.
- [CC-003: modelo canónico de polos](cc003-canonical-polo-model.md) — RLS opt-in, limitações e gates.
- [Integração #252](release-integration-20261023.md) — composição técnica da cadeia.
- [Readiness CC-009 a CC-020](release-readiness-cc009-020.md) — evidência e limitações dos testes anteriores.
- [Regras e desempenho do Balcão](../performance/balcao-m2-finance-integration.md) — gates financeiros e limites da réplica setorial.

**Política editorial:** ao citar documentação anterior à PR #252 ou #253, distinguir sempre (a) pendente na data da auditoria, (b) integrado na `main`, (c) instalado no Supabase, (d) deployment READY e (e) homologação real. Estes cinco estados não são equivalentes.
