# M4 — reconciliação PR #211, #212, #213

Verificado em GitHub em 21/10/2026. Branch da PR #213: `perf/balcao-measured-20261021`; PR #211 em `feat/workspace-evolution-20261020`, head `1a60a6c`; PR #212 em `feature/klasse-ai-inventory-consolidation-20261020`, head `2ab48b9`. Ambas ainda abertas na consulta. Nenhuma PR foi mesclada para `main`.

## Confronto do merge simulado

- `git merge-tree --write-tree HEAD refs/remotes/pr/211`: **conflitos textuais** em `BalcaoPageClient.tsx` e `CommandCenterPanel.tsx`. PR #211 remonta o único painel a cada navegação, e seu teste exigia exclusivamente o dossiê interativo; PR #213 retém componentes, preserva rascunhos, atualiza estados financeiros, e anteriormente usava um segundo dossiê SSR.
- `git merge-tree --write-tree HEAD refs/remotes/pr/212`: **sucesso**, sem conflitos textuais. O copiloto tem consultas próprias, read-only e autorizadas pelo próprio módulo; **não** deve reutilizar cache de dados pessoais do balcão e **não** há segunda fonte de edição.
- Integração `#213 + #212 + #211` em worktree destacada, **não enviada nem mesclada**: conflitos de interface resolvidos mantendo o `RetainedActionPanels` e as props de invalidação da #213 e adotando o dossiê interativo único exigido pela #211. API de notas, `PautaRapidaModal` e correções de grade da #211 permaneceram integralmente; todas as rotas de copiloto da #212 foram preservadas.
- Houve uma expectativa textual obsoleta no teste `kf2-search-audit.test.ts` de #211: `refreshKey={profileRefreshKey}` não considera a invalidação segura `+ refreshRevision`. No teste combinado descartável, o assert foi adaptado para admitir o mecanismo real, sem alterar autorização.
- A tipagem da #212 originalmente fazia `.select("id,turma_id,status,ano_letivo_id")`, coluna inexistente no tipo real `matriculas`. A branch de integração descartável adaptou **somente o teste/integração**, usando `ano_letivo`, nome existente. **A PR #212 precisa de sua própria correção** antes de seu merge; não reimplementar nem duplicar ferramenta de copiloto dentro da #213.

## Evidência executada

- Worktree descartável `/Users/gundja/klasse-balcao-integration-211-212`, HEAD de integração simulado `ee1fcb5` (versão inicial; após reintegração existe novo commit local de teste).
- Testes de contrato financeiro, grade e workspace: **24/24 passaram**; teste KF2: **13/13 passaram** após reconciliação do assert; lint: **0 errors** (warnings herdados no repositório).
- Typecheck combinado: **passou após corrigir somente na branch descartável o campo inexistente na #212**. Isto não implica que a PR #212 isoladamente esteja verde, nem autoriza seu merge.
- Correções funcionais incorporadas à #213: um único dossiê interativo para modal/página, mantendo `refreshRevision` e cache de UI limitado por user/escola/polo/aluno; nova matrícula nunca herda matrícula anterior.

## Decisão de revisão

PR #213 não incorpora nem faz merge dos commits #211/#212. No merge futuro, a #211 deve preservar o retention boundary e substituir o teste textual legado, e a #212 deve corrigir seu campo SQL/tipo por conta própria. Todas as decisões preservam a fonte canônica de pagamentos, as permissões e o isolamento de contexto. Nenhum backend/guard/migration é alterado nesta reconciliação.
