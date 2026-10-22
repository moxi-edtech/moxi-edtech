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


## Resultado do replay integral descartável — blocker real de histórico

Em GitHub Actions, workflow **Command Center Full Local Migration Replay**, execução
[39811144909](https://github.com/moxi-edtech/moxi-edtech/actions/runs/39811144909),
a stack Supabase local arrancou em PostgreSQL 17, sem ligação à produção
e sem dados reais. O replay foi efectivamente iniciado e parou na migration
**`20260202011000_backfill_pagamentos_aluno_id.sql`**, antes das novas migrations:

```text
ERROR: column p.aluno_id does not exist (SQLSTATE 42703)
UPDATE public.pagamentos AS p SET aluno_id = m.aluno_id
FROM public.mensalidades AS m WHERE p.aluno_id IS NULL
```

A baseline anterior não possui a coluna exigida pela migration. A equipa
não deve adulterar ficheiros já aplicados, criar uma migration retroactiva
ou tocar em produção para fazer um CI passar. A reprodução completa,
reaplicação e reversão sobre políticas RLS reais ficam bloqueadas até
existir uma **baseline estrutural verificada do banco actual** e um
procedimento de replay consistente com a história de migrações.

O teste isolado da autorização de pesquisa da PR #234 passou em PostgreSQL
17 com RLS de fixture. **Não substitui o replay integral.**

**Passo técnico gated:** obter apenas esquema/catálogo e histórico de
migrações de produção em modo read-only, reconciliar a baseline
num ambiente descartável, criar PR independente de correcção de história
sem editar migrations aplicadas, executar dois resets, testes de
políticas verdadeiras e rever as diferenças antes de autorizar merge.
