# KLASSE — Reconciliação de PRs antigas (21/11/2026)

Base verificada: `main` em `5828fd96c274a3a08c163611214a8fd8fb316878`. Este registo é uma decisão de engenharia com evidências pontuais, **não** homologação autenticada nem autorização de deploy. PRs encerradas continuam acessíveis no GitHub, com diffs e branches preservados.

## P0: integração e segurança

| PR | Constatação verificável | Decisão |
| --- | --- | --- |
| [#415](https://github.com/moxi-edtech/moxi-edtech/pull/415) UI operacional | Conflito com #418: a versão antiga substituía paginação por cursor de Classes por paginação local. A branch foi reconciliada manualmente com a `main`, preservando cursor do servidor e todas as correções de tenant de #419/#420; mantém filas de Documentos/Faltas, diálogos e testes | Branch atualizada no commit `9a61f1c`; CI 11/11 verde. **QA autenticado ainda obrigatório antes de integrar/publicar.** |
| [#344](https://github.com/moxi-edtech/moxi-edtech/pull/344) progressão RAA | Migration `20271117160000_guard_enrollment_prior_year_progression.sql` propõe trigger `SECURITY DEFINER` de ativação em `matriculas`. No Supabase consultado **não existe** `trg_klasse_guard_enrollment_raa_progression` nem versão no ledger. O trigger pode bloquear matrículas de todas as escolas, não apenas Curtume | Não mergir/migrar sem testes descartáveis de RAA em Pré-Escolar, 1–9, finalistas, repetentes, transições históricas, reserva vs ativação e autorização. Rever dependências, privilégios, locks, carga concorrente e rollback. |
| [#376](https://github.com/moxi-edtech/moxi-edtech/pull/376) espelhamento notas históricas | Sete migrations encadeadas `20271119110000`–`110600` incluem `SECURITY DEFINER`, reescrita dinâmica de guards SQL e sincronização de notas. **Várias funções `curtume_2025_*` já estão presentes na base**, mas estas versões não constam no ledger de migrations. Não assumir que objetos presentes implicam migrations formalmente aplicadas ou equivalentes ao código do PR | Não executar replay. Reconciliar `pg_get_functiondef`, versões no ledger, hashes das fontes, quantitativos por estado, audit/lock e impacto em WAL/I/O; executar dry-run read-only e fixtures em base descartável antes de qualquer transação real. |
| [#387](https://github.com/moxi-edtech/moxi-edtech/pull/387), [#389](https://github.com/moxi-edtech/moxi-edtech/pull/389) hotfix Turmas | `main` já usa `rawToast` estável do `FeedbackSystem` em `loadData`; patch das PRs está incorporado na área funcional | Encerradas sem merge por equivalência. Preservar [#394](https://github.com/moxi-edtech/moxi-edtech/pull/394) como snapshot de release distinto; não alegar deploy nem alterar rollback. |

## P1: recuperação seletiva, não cherry-pick indiscriminado

| PR antiga | Lacuna observada na `main` | Recuperação focada |
| --- | --- | --- |
| [#371](https://github.com/moxi-edtech/moxi-edtech/pull/371) listas/branding | JSON legado de lista de turma aplicava `defaultLimit:50` apesar de PDF/XLSX usarem o leitor nominal paginado; módulo `schoolLogo.ts` do PR antigo não integra a `main` | [#422](https://github.com/moxi-edtech/moxi-edtech/pull/422) troca JSON para `loadNominalRoster` e preserva projeção mínima, âmbito da escola e ordenação. Logo deve ser tratado à parte: sanitizar URL, evitar SSRF e preservar template e dados privados. |
| [#372](https://github.com/moxi-edtech/moxi-edtech/pull/372) Balcão | Consulta de matrícula de origem omitia estados `concluido` e `concluida` | [#421](https://github.com/moxi-edtech/moxi-edtech/pull/421) acrescenta apenas os estados no filtro existente e teste; sem alterações de notas/matrículas/RAA. |
| [#385](https://github.com/moxi-edtech/moxi-edtech/pull/385) Professor | Chamada não tinha `aria-pressed`, números estáveis na pesquisa nem desistência em ações secundárias. Skeleton da lista de Planos omitira estado/botão de edição | [#423](https://github.com/moxi-edtech/moxi-edtech/pull/423) recupera pontos faltantes usando componentes atuais; não sobrescreve #409. |
| [#321](https://github.com/moxi-edtech/moxi-edtech/pull/321) Pré-Escolar | A função `resolve_regime_academico(uuid)` da base já tem o desvio `pre_escolar` qualitativo com exames inaplicáveis, mas a migration original não estava no ledger. | #321 integrada na `main` (`5828fd96`) para versionar essa definição. **Nenhuma migration aplicada ao banco nesta reconciliação.** Conferir ledger/deploy controlado; nunca fazer mudanças retroativas gerais nas turmas. |

## Arquivo de PRs de conceitos substituídos

A [#310](https://github.com/moxi-edtech/moxi-edtech/pull/310) já inventariou os riscos de restaurar branches antigas do Command Center e Portal do Aluno após versões posteriores. Encerrar PRs duplicadas **sem merge**, com justificativas e links para este documento: #200, #201, #202, #203, #204 (portais/avisos), #236, #237, #238 (Command Center). Este arquivo não afirma que todo protótipo original esteja funcionalmente homologado; qualquer lacuna concreta precisa de nova PR baseada em `main` e teste autenticado.

Não arquivar automaticamente cadeias fiscais BILL/AGT (#118–#131), recibos/outbox (#184), nem qualquer PR de alteração de dados/autorizações. Estas exigem decisão e execução próprias.

## Gates comuns

1. CI no **HEAD final** de cada PR (não apenas CI antigo de branch empilhada), typecheck/lint e revisões de segurança.
2. Smoke autenticado em duas escolas/roles, estado sem dados, >50 alunos, transições de sessão/ano, mobile/teclado e erro de rede.
3. Para SQL: diff de funções em produção vs migrações, políticas/RLS, `SECURITY DEFINER` e grants, cenário de rollback, fixture transacional, medições WAL/Disk I/O; nenhuma nova automação de refresh global.
4. Separar merge na `main` de deploy Vercel e migração de banco; confirmar cada um pelo commit/ledger real.
