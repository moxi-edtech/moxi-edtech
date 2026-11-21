# KLASSE — PR 2 · Identidade e mobile

## Escopo deste lote

- Formulários partilhados (`Input`, `Select`) usam geometria, foco e mensagens de erro consistentes, preservando todas as props e opções existentes.
- O cabeçalho partilhado passa a quebrar ações e breadcrumbs em ecrãs estreitos, sem criar uma segunda implementação.
- O editor de Planos de Aula do professor usa o inset padrão, o `Button` partilhado e skeletons que correspondem à grelha real; a página não mostra um formulário vazio antes do primeiro carregamento.
- O skeleton de Configurações elimina a largura mínima que causava overflow em mobile e respeita preferência por movimento reduzido.

## Compatibilidade e segurança

- Sem alterações de APIs, autorizações, cookies, RLS, migrações, RPCs, pagamentos ou persistência.
- O `Select` sem rótulo nem erro mantém o mesmo elemento `<select>` na raiz. Com erro, recebe descrição visível e `aria-invalid`.
- Validação do servidor continua autoritativa. Skeletons não simulam dados académicos; não mostram estados financeiros falsos.
- A dependência da PR 1 limita-se ao comportamento partilhado de `Button`; nenhuma modificação dos seus contratos nesta PR.

## Validação / rollout

- Executar `node --test --import tsx apps/web/tests/unit/ui-identity-mobile.spec.tsx`, `pnpm -C apps/web typecheck` e o gate `check:ui-standards`.
- Validar visualmente com 320, 375, 768 e 1440 px; teclado, Safari/VoiceOver, light/dark e zoom 200%.
- A PR 2 completa inclui inventário e revisão das páginas restantes de todos os portais. Este lote cobre o núcleo de formulários/cabeçalho e duas superfícies prioritárias, **não** certifica todos os ecrãs.
- Não fazer merge ou deploy sem QA autenticado, especialmente após integrar a PR #398.
