# KLASSE — auditoria transitive de temas, componentes globais e CSS (22/11/2026)

## Objetivo

Auditar o tema Claro/Escuro/Sistema além dos ficheiros de rota e dos componentes diretamente listados na PR #450. Esta intervenção percorre os imports estáticos, re-exports, imports dinâmicos com string literal, componentes globais montados pelo layout raiz, estilos inline e folhas CSS alcançáveis. A alteração é exclusivamente de apresentação.

**Branch:** fix/theme-transitive-global-css-20261122 — empilhada sobre a PR #450. As PRs #447, #448 e #449 constituem a base da #450, que já reconciliou o trabalho da #446.

## Inventário reproduzível

Scanner: scripts/audit-klasse-theme-transitive.mjs. Executar com a opção --check para validar no CI.

| Medida | Resultado |
|---|---:|
| Entradas operacionais Escola/Secretaria | 333 |
| Entradas totais incluindo componentes globais explícitos | 343 |
| Módulos transitivos identificados | 895 |
| Ficheiros TSX alcançáveis | 684 |
| Ficheiros TS adicionais | 206 |
| Folhas CSS alcançáveis | 5 |
| Imports locais não resolvidos | 0 |
| Imports dinâmicos com caminho calculado | 0 |
| Bibliotecas diretas de gráficos na árvore | Recharts (2 consumidores) |
| Propriedades de estilo inline auditadas inicialmente | 175 |
| Cores inline literais inicialmente | 30 |
| Cores inline literais após correção | 4, exclusivamente PDF de pautas |
| Exceções de classes neutras documentadas | 31 ocorrências, 7 ficheiros |

A contagem de módulos representa dependências alcançáveis estaticamente, não necessariamente componentes renderizados num único ecrã. Os imports do tipo TypeScript podem levar a ficheiros que nunca são montados; não são uma afirmação de utilização visual simultânea.

## Componentes de Aluno/Professor reutilizados nas operações

A reconciliação demonstrou reutilização efetiva dos componentes, em vez de uma mera semelhança nominal:

- GradeEntryGrid (Professor): utilizado na pauta rápida, em Notas da Secretaria, na Rematrícula, na turma e nas notas retroativas da virada académica.
- AlunoPerfilPage e DossierSeccoes: utilizados em Secretaria → Alunos, Admin → Alunos e modal de Operações; DossierSeccoes também é usado diretamente no Command Center.
- DossierAcoes, DossierHeader, DossierTabs, histórico transitado e timeline: dependências internas do perfil e das ações administrativas.
- StudentReceiptHistory, AcademicCarryoversCard e PaymentDrawer: componentes do ecossistema aluno cujas superfícies acompanham agora os tokens semânticos.
- Rectificação de matrícula e modal de dossier: overlays de acesso usam o token classe dark para não depender de um cinza fixo.

As alterações restringem-se a classes, aparência e foco. Nenhum contrato de notas, matrícula, pagamento, API, RLS ou RPC foi alterado.

## Componentes globais

- Sidebar: mantém o painel institucional intencionalmente escuro. Estados ativos e ícones usam tokens klasse-gold, evitando hexadecimais inline.
- CommandPalette: overlay escuro semântico, foco institucional e seleções com contraste por tema.
- NotificacoesDropdown: ação principal usa o dourado de CTA; cartões e popover mantêm superfícies semânticas.
- FeedbackSystem: pequenos grupos de controles de contraste deixam de depender de branco translúcido fixo.
- Harmonia: ConfirmacaoContextual, EstadoVazio e FluxoPosAccao deixam de fixar fundos, textos e sombras em hexadecimais. Preservam confirmação, próximos passos, callbacks e transições.
- Outros layouts partilhados: nenhum novo componente com cor neutra fixa pode entrar na árvore de imports sem rever o orçamento de exceções.

## CSS, estilos inline e gráficos

- globals.css define os tokens de raiz e modo escuro; os valores de marca específicos dos portais Aluno/Professor estão sob classes .klasse-portal-theme. O guard agora rejeita novas cores literais em CSS global fora desses três escopos aprovados.
- theme-print.css e três estilos module.css usados em impressão continuam estáveis, independentemente da preferência de tema.
- Os únicos quatro valores literais remanescentes em style inline estão em dois templates PDF do Ministério, não em elementos interativos.
- ChartsSection já utilizava variáveis semânticas para eixos e grelhas; o contorno dos pontos passou a var(--card), deixando de forçar branco em Dark.
- KpiCard usa var(--muted-foreground) nos gráficos neutros, var(--chart-2) no sucesso e a cor institucional de ouro no alerta. Estados financeiros vermelho/verde/dourado continuam distintos.

## Exceções justificadas e limitadas

scripts/klasse-theme-transitive-exceptions.json documenta por ficheiro, motivo, classe e quantidade máxima as 31 exceções permitidas:

- Sidebar institucional sempre escuro e SidebarNav;
- cartão de estudante oficial com apresentação estável;
- aviso PWA deliberadamente escuro e indicador de conectividade;
- ramificação exclusiva de impressão em AppShell;
- regra com prefixo print: no relatório financeiro.

O guard percorre os componentes alcançáveis e rejeita novos usos de classes fixas acima da contagem explicitamente aprovada, bem como quaisquer novas classes não previstas. Isso não constitui autorização para alargar indiscriminadamente a allowlist.

## Garantias e limites

- Testes de árvore de imports, CSS, estilos inline, gráficos e limites das exceções estão em scripts/audit-klasse-theme-transitive.test.mjs e no workflow Theme Switcher Guard.
- O scanner cobre fontes locais TS/TSX e CSS resolvidas estaticamente. Estilos internos de bibliotecas de terceiros, cores geradas por dados em tempo de execução e resultados após autenticação continuam a exigir validação visual.
- As classes Tailwind deliberadamente escuras em navegação, artefactos de impressão, documentos oficiais e cores de estados de negócio não devem ser convertidas mecanicamente.
- Não foram feitas migrações, consultas operacionais a dados escolares ou mudanças em permissões.

## Release

Exigir CI verde do último commit desta PR, revisão de contraste e responsividade em rotas autenticadas com as três preferências, reconciliação da pilha #447–#450 e merge controlado. A existência do guard não comprova a publicação da interface na Vercel.
