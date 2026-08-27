# Apply Diff — painel RAA mobile

Ficheiro: `apps/web/src/app/professor/notas/page.tsx`

Melhorias:

- mantém o painel visível após carregamento mesmo quando não existem riscos;
- adiciona estado vazio explícito e skeleton de carregamento;
- amplia alvos de toque, foco por teclado e `aria-label`;
- melhora a leitura de nomes longos, etiquetas de risco e próximo passo.

Validação: `git diff --check` e revisão localizada do componente. O lint completo do workspace foi interrompido após permanecer sem saída por mais de 90 segundos.
