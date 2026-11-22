# KLASSE — Cobertura de temas nas rotas internas (2026-11-22)

## Objetivo

Garantir que as páginas internas das escolas e da Secretaria, incluindo os componentes renderizados em operações diárias, acompanham os temas Claro, Escuro e Sistema. Esta auditoria é sobre código de UI e não modifica operações académicas, financeiras, isolamento multi-tenant ou RLS.

## Base e integração

- Origem: PR #447 (Theme Switcher P0), sobre a qual estão empilhadas a #448 (23 componentes internos) e a #449 (6 componentes do Super Admin).
- A PR #446 (Alunos, Turmas, Fluxos e componentes de Secretaria/Académico) foi reconciliada por merge sem conflitos nesta branch. O workflow resultante mantém os testes das duas frentes.
- Esta branch deverá ser integrada somente depois de #447, #448 e #449, para não incluir alterações não revistas e para preservar as correções da #446.

## Cobertura e verificação reproduzível

**Guard de cobertura:** scripts/check-klasse-operational-theme-scope.mjs.
**Testes:** scripts/check-klasse-operational-theme-scope.test.mjs.

O script consulta os ficheiros controlados por Git e cobre 580 ficheiros TSX nas rotas Escola/Secretaria e nos diretórios operacionais partilhados. Não utiliza amostras nem se limita aos ficheiros alterados na PR. Bloqueia classes fixas de fundos, texto, bordas, divisórias, foco e cores inline em classes Tailwind. A validação local terminou com **zero classes não autorizadas** e **7 testes do guard aprovados**.

O script passou a ser executado no workflow Theme Switcher Guard para impedir regressão futura.

| Área de produto | Alterações verificadas |
|---|---|
| Secretaria, admissões, rematrícula e RAA | Botões e estados de decisão; correções da #446 nos modais, turma e Balcão; contraste dos componentes partilhados |
| Financeiro, propinas, caixa e relatórios | Guardar preços, filtros de status, recebimentos, fecho, extratos, relatórios, alertas e confirmação |
| Configuração escolar e currículo | Currículo, disciplinas, matriz, presença, calendário, mensalidades, configuração académica, assistência de configuração |
| Admin, notas, turmas e operações | Lista de alunos, filtros, turmas, estados de notas, ações administrativas, criação e gestão |
| Horários, professores e avaliações | Seletor e gerador de grelha, preview, publicação, relatórios de avaliação e agenda |
| Documentos, migração e acesso | Download de documentos, importação em massa, acesso, notificações e fluxos de recuperação |
| Páginas adicionais da #446 | Alunos, Turmas e Fluxos + 20 componentes específicos, integrados na branch |
| Componentes atravessando módulos | KLASSE IA, autenticação e estados globais, com cartões e textos semânticos |

## O que permanece intencional

- **Print/PDF:** documentos oficiais, recibos, páginas de impressão e classes Tailwind com o prefixo print: mantêm cores estáveis para impressão A4.
- **Fiscal:** o módulo fiscal fica fora da intervenção, sem alterar conformidade, pagamentos nem lógica tributária.
- **Portais autónomos Aluno/Professor:** mantêm a política própria de tema; componentes específicos desses portais não foram massivamente alterados.
- **Fundo escuro de marca e modais:** overlays usam o token semântico klasse-dark; transparências brancas em painéis permanentemente escuros são permitidas apenas nos ficheiros expressamente revistos pela allowlist do guard.
- **Marca WhatsApp:** o verde oficial permanece apenas nas integrações WhatsApp declaradas na allowlist.
- **Cor dinâmica de eventos:** mantém a cor escolhida pela escola quando fornecida; na ausência dela, o fallback agora usa var(--muted-foreground), que acompanha o tema.
- **Sidebar institucional:** preserva estados escuros de navegação e convenções de contraste próprias.

O número zero refere-se às **classes fixas proibidas pela auditoria de código nos 580 ficheiros cobertos**, não à ausência de quaisquer valores literais em recursos estáticos, nem à aprovação visual de todas as rotas autenticadas.

## Gates para integração

1. Guard e testes locais: 28 testes combinados aprovados na primeira execução (incluindo verificações de #446/#447/#448/#449).
2. TypeScript completo e CI da branch: exigir aprovação antes do merge.
3. Revisão visual autenticada em mobile/desktop e nas três preferências, incluindo dados sintéticos para estados financeiros.
4. Sem migração Supabase, sem alteração de contratos da API/RPC, sem alteração de permissões ou funcionalidades.

## Limites

O scanner atua sobre classes Tailwind em ficheiros TSX; cores inline de bibliotecas de gráficos, dados de negócio que definem cor (eventos), recursos de impressão e CSS central de tokens precisam de verificações especializadas próprias. Assim, esta ronda fecha dívida de cores neutras fixas no âmbito auditado, sem afirmar uma certificação visual integral de produção.
