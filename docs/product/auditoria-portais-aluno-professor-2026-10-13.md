# Auditoria UI/UX — Aluno e Professor (Fase 1, evidência inicial)

Base: branch feature/portais-aluno-professor-ux-20261013; referência: docs/product/graciosidade.md, docs/portal-professor.md e docs/product/workspace-product-design-audit-2026-10-07.md.

## Cadeia de montagem comprovada

- Aluno: `apps/web/src/app/(portal-aluno)/aluno/layout.tsx` importa `AlunoLayoutClient` do mesmo diretório; este importa `@/components/aluno/layout/AlunoHeader`, `AlunoBottomNav`, `NetworkStatus` e `PWAInstallPrompt`, e renderiza `children`. A área principal usa `max-w-5xl` e `md:p-6`.
- Professor: `apps/web/src/app/professor/layout.tsx` importa `ProfessorPortalLayout`, que usa `AppShell`, `ProfessorBottomNav` e `professorNavItems`. `apps/web/src/app/professor/page.tsx` implementa o dashboard e consome APIs existentes.
- Existe também `apps/web/src/app/escola/[id]/professor/layout.tsx` que importa `ProfessorPortalLayout`; inspecionar a árvore completa e o comportamento de reescrita de rotas antes de alterar redirects.

## Classificação dos achados preliminares

| Achado | Classificação | Evidência / decisão |
| --- | --- | --- |
| TODO de notas, pagamentos e presenças em `src/modelo_portal_do_aluno/PortalAlunoLayout.tsx` | CODIGO_MORTO (na cadeia de montagem inspecionada; verificar referências dinâmicas antes de remover) | A rota do aluno monta `AlunoLayoutClient`, não o modelo alternativo. **Não implementar o TODO**; remoção somente em commit separado após busca exaustiva. |
| Limite de 430 px e estilos globais no modelo alternativo | FALSO_POSITIVO para o layout efetivamente montado | `AlunoLayoutClient` usa `max-w-5xl`, sem o limite de 430 px. Preservar abordagem mobile-first e validar no browser. |
| Pendências de navegação, redirects e estados vazios do professor | CONFIRMADO como backlog documentado; incidência em produção ainda não comprovada | `docs/portal-professor.md` lista explicitamente redirects, nav e empty states pendentes. |
| Recuperação com `window.location.reload()` no dashboard do professor | CONFIRMADO | `apps/web/src/app/professor/page.tsx` define `loadAgain = () => window.location.reload()`. |
| Polling periódico no dashboard do professor | CONFIRMADO | Há intervalos de 15 s (relógio) e 30 s (consulta de aulas), sem teste ainda de visibilidade da aba. |

## Lacunas de evidência e gates obrigatórios

1. Completar árvore de rotas do aluno/professor e procurar importações estáticas/dinâmicas do modelo alternativo antes de qualquer remoção.
2. Auditar componentes e contratos de API por escola/polo, sem modificar RLS, policies, migrations, motor financeiro ou guards fiscais.
3. Implementar retries sem reload e polling com visibilidade/limitação de concorrência, acompanhados de testes.
4. Testar fluxos com fixtures e autenticações segregadas (aluno A/B, professor escola A/B), sem dados reais em capturas.
5. Capturar as cinco resoluções solicitadas em 100/125/150% de zoom, verificar overflow e scroll aninhado; anexar evidências verificáveis.
6. CI integralmente verde e diff revisado são pré-requisitos para merge. **Não fazer merge/deploy enquanto esses gates estiverem abertos.**

## Justificativa arquitetural

Reutilizar o shell existente, as fontes de dados canónicas e o contrato de graciosidade; não instalar bibliotecas. O modelo alternativo não pode ser confundido com a UI montada. Priorizar recuperação segura de contexto no professor antes de alterações cosméticas.

## Verificação adicional de referências (2026-10-13)

Busca recursiva com `rg -n 'modelo_portal_do_aluno|PortalAlunoLayout' .` encontrou apenas: o próprio ficheiro alternativo, este documento, exclusão em `apps/web/tsconfig.json`, e referências de ferramentas em `scripts/check-klasse-ui-standards.mjs` e `scripts/validate-navigation.sh`. Não houve referência de importação estática, `import()` ou `next/dynamic` ao componente alternativo na árvore pesquisada. Classificação do **componente**: CODIGO_MORTO; o **diretório** ainda é referenciado por tooling, pelo que sua remoção completa exige auditar o conteúdo e ajustar as ferramentas em commit separado. Nenhum TODO do modelo foi ligado à produção.

A rota efetiva do aluno usa `AlunoLayoutClient` com `max-w-5xl` e filhos das rotas; dados reais devem ser auditados nas páginas montadas, não substituídos por consultas do modelo alternativo. Sem capturas de tablet/desktop, a largura permanece inalterada.

## Alteração incremental da Fase 2

A dashboard do professor passou a usar retry por `retryVersion` sem recarregar a página e polling que evita requisições concorrentes, pausa em abas ocultas e faz backoff até cinco minutos. O teste de contrato estático `apps/web/tests/unit/professor-dashboard-recovery.spec.mjs` valida estes invariantes; isso **não substitui** testes funcionais nem E2E.

## Boletim pago — fluxo aluno / secretaria (13-10-2026)

Contrato aplicado no PR #194:

1. **Configuração do valor:** a escola define a taxa real do serviço `DOC_BOLETIM_TRIMESTRAL` em Administração → Configurações → Emolumentos & Serviços. Valor padrão zero **não** concede acesso a notas e não é cobrado como se fosse taxa configurada. Um `DOC_DECLARACAO_NOTAS` historicamente pago é aceite apenas se houver pagamento positivo efectivamente liquidado.
2. **Aluno:** em «Notas» vê o valor, o link directo ao serviço na Secretaria Digital e os estados «por pagar», «comprovativo enviado», «rejeitado» e «confirmado»; após confirmação pode consultar os valores das avaliações realmente lançadas, sem médias trimestrais/finais inventadas. Pode baixar um novo PDF, mesmo que outras avaliações estejam por lançar.
3. **Secretaria:** comprovativos de serviços pagos são tratados em Secretaria → Recebimentos, no fluxo existente de `validar_lote_pagamentos`. O operador revê aluno, valor esperado e comprovativo; confirmação liquida a intenção e concede o pedido. A fila de documentos gratuitos não substitui nem duplica a decisão financeira.
4. **Autorização:** todas as rotas que expõem notas verificam o mesmo par `servico_pedidos.granted` + `pagamento_intents.settled` e valor positivo, sempre para escola, aluno e matrícula. Apenas `settled` ou apenas `granted` não basta. Falhas de verificação negam acesso; cobranças são idempotentes na RPC existente.
5. **Actualidade:** o portal e o PDF consultam directamente `notas` e `avaliacoes`, evitando esperar pelo cron da vista materializada do boletim. Cada avaliação é exibida pelo nome/tipo/trimestre, incluindo notas zero, e as avaliações ainda sem nota ficam ausentes. O PDF pagina e é regenerado a cada pedido.
6. **Recuperação:** o aluno não precisa de voltar a entrar após a validação; verifica-se o estado em primeiro plano quando a página está activa, ao recuperar foco, ou pelo botão «Actualizar». Um erro de rede é explicado sem sugestão de pagar novamente.

Sem novas tabelas, migrations, RLS nem motor de pagamento. Para validar com escola real é necessário confirmar valor configurado e executar um cenário de pagamento de teste autorizado (não usar matrícula real sem autorização).

Validação automatizada localizada: `node --import tsx --test tests/unit/aluno-boletim-flow.spec.mjs tests/unit/aluno-boletim-payment-gate.spec.mjs` no directório `apps/web`. O teste de isolamento usa duas escolas, dois alunos e duas matrículas fictícias; o PDF é exercitado com 125 avaliações, incluindo paginação.
