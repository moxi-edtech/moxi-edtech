# KLASSE — PR 4 · Remover estilos legados e duplicações reais

Base: `main` após PR #413. Objetivo: reduzir manutenção de apresentação sem inventar ações nem alterar as regras de negócio.

## Inventário comprovado

- `components/Card.tsx`: card antigo com props próprias (`title`, `icon`, `value`) consumido apenas pelo Storybook. Migrou-se a story para `components/ui/Card`, sem alterar o `Card` oficial.
- `components/auth/LogoutButton.tsx`: sem importações em rotas ativas; tinha limpeza offline incompleta. A aplicação usa `auth/SignOutButton.tsx` com limpeza de rascunhos, identity-card cache, dados offline e revogação da sessão local e no servidor. O fluxo seguro foi **mantido**, não reimplementado.
- `components/aluno/financeiro/StatusPill.tsx`: mapeamento local `pago/pendente/atrasado` duplicava `components/ui/StatusPill.tsx`. A tabela de mensalidades agora usa `variant="financeiro"` do componente partilhado. Não altera o status fornecido pelo backend.
- `components/secretaria/AlunosSecretariaPage.tsx` e `components/secretaria/AlunosListClient.tsx`: dois `StatusBadge` locais divergiam nos tons (incluindo `aprovada`). Ambos agora usam `StatusPill` central no modo matrícula; mapeamento central reconhece `aprovada`, `submetida` e `suspenso` com tonalidades semânticas. Rótulos/dados preservados.
- `components/secretaria/tasks/*` e `components/secretaria/dashboard/*`: seis ficheiros órfãos não importados por rotas/consumidores ativos; havia versões reduzidas de `TaskList` e `NoticePanel` sem as ações reais. Foram removidos. Os módulos canónicos permanecem em `components/dashboard/`, com os filtros, snooze, actions e o `EstadoVazio` partilhado.

Total: **9 ficheiros de implementações antigas removidos**. O número não inclui mudanças no componente partilhado e documentação.

## Identidade visual consolidada

- Página de Professores da Secretaria: eliminados `moxinexa-*`, `bg-muted0`, raios legados e CTA fora do padrão. Botão de criação usa ouro; título usa verde, sem mudar URLs ou carregamento.
- Página ativa de Alunos da Secretaria: substituição de hex fixos pelos tokens `klasse-green` / `klasse-gold`, raios `rounded-xl`, campos com foco e superfícies compatíveis com tema. Cor de perigo (dívida/erro) continua semântica.
- `components/dashboard/NoticePanel`: manteve os recursos canónicos do Balcão (categorias, prioridade, postergar, ações de aviso); estilos ajustados a `bg-card`, `border-border` e foco/área de toque. Tabs expõem `aria-pressed`. Não foi substituído pelo widget órfão mais simples.

## Garantias e limitações

- A remoção foi precedida de verificação de consumidores no projeto. As rotas ativas não importavam os ficheiros apagados.
- Zero alterações em endpoints, pagamentos, matrícula, aprovações, permissões, RLS ou migrações.
- Testes asseguram remoção física de duplicações, estados semânticos, manutenção das rotas e das ações do painel de avisos, além dos contratos UI das PRs anteriores.
- QA autenticado mobile, dark mode, zoom 200% e VoiceOver segue necessário para certificar visualmente os fluxos; testes automatizados não o substituem.

### Backlog não abrangido por esta PR

1. **Auditar ações inertes em `components/dashboard/TaskList.tsx`**: existem botões `Aprovar` / `Rejeitar` sem handlers. Não se criou chamada de servidor por suposição; exigir contrato real, autorização e auditoria antes de os tornar operacionais, ou então retirá-los da interface após decisão de produto.
2. **Auditar moedas em `components/aluno/financeiro/MensalidadesTable.tsx`**: componente legado apresenta `R$` num produto direcionado a Angola. Exige confirmação de dados da API e regras de moeda antes de alterar o formato.
3. Continuar inventário de wrappers e cards ainda usados antes de uma remoção maior. Componentes com nomes semelhantes mas contratos diferentes não foram fundidos indiscriminadamente.
