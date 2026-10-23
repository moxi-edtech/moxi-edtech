# Command Center / Balcão — P0: decisões e gates

Base: PR #234. Esta branch não faz merge, deploy ou alterações directas em banco de produção.

## Decisões de compatibilidade

- A PR #216 altera o Balcão e a PR #232 protege a liquidação: **nenhum ficheiro do motor financeiro ou das escritas do Balcão foi alterado aqui**. O componente BalcaoWorkspace existente continua único.
- A PR #231 já trata Professor na Secretaria, absorvida pela #234; não criar segundo explorador.
- O retorno contextual não é autorização: apenas identificadores e estado de leitura, limitado a dez minutos, e escopado por utilizador, escola, polo, ano e portal. Se não houver utilizador autenticado, não guardar o regresso.
- O polo é obtido de `poloId` ou `polo_id` na URL; **não afirmar isolamento suficiente se o polo canónico estiver seleccionado noutra store**. Confirmar ponto de origem e incluir a identidade canónica antes de permitir rollout.
- Um aluno que deixou de constar da página após recarregar produz um aviso, em vez de mover o foco para outra pessoa. O aviso não atribui causa (transferência/cancelamento/trancamento), que exige consulta autorizada.
- O histórico de pesquisas é transitório e limitado a seis entradas; cache limitado a cinquenta pesquisas e invalidado após eventos de autenticação, sem guardar BI e processo.
- A migração de #234 permanece **apenas versionada**: sem aplicação em produção.

## Gates de aceitação ainda não satisfeitos

1. E2E autenticado com contas ficcionais criadas no próprio teste: três atendimentos seguidos; 55 matrículas para capacidade 50; escolas A/B; polos 1/2; Director, Secretaria, Admin Geral e perfil negado; sessão expirada e rascunho.
2. Replica estrutural descartável fiel ao último banco, **todas** as migrations e políticas reais, com aplicar/reaplicar/reverter a migração de autorização (sem alterar ficheiro aplicado).
3. Capturas reais de Playwright, cinco larguras e três níveis de zoom, com fixture e evidências anexadas.
4. Verificar coexistência com #213/#216 e #232, especialmente salvaguardas de rascunho e mudanças de aluno.
5. Não promover `READY` ou CI estática a homologação.

## Comandos previstos em ambiente descartável

```bash
pnpm install --frozen-lockfile
pnpm -C apps/web typecheck
pnpm -C apps/web exec eslint src/components/CommandPalette.tsx src/components/secretaria/command-center/ClasseContextView.tsx src/components/secretaria/command-center/TurmaContextView.tsx src/hooks/useGlobalSearch.ts --max-warnings 0
pnpm -C apps/web exec tsx --test tests/unit/command-center-operational-continuity.spec.ts
gh run list --repo moxi-edtech/moxi-edtech --branch feat/cc-p0-session-continuity-20261022
```

**Gate de produção:** aprovação humana e migração em pipeline; nenhum comando de `db push`, `migration up` ou deploy deve ser executado nesta tarefa.

