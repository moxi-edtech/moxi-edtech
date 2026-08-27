# Apply Diff — onboarding currículo/calendário

Ficheiro: `apps/web/src/app/api/escolas/[id]/onboarding/core/finalize/route.ts`

Alterações validadas:

- serializa instalações concorrentes por escola, preset e ano letivo com `lock_curriculo_install`;
- garante a associação do curso ao calendário com `ensureCurriculumCourseOffering`;
- mantém a falha explícita quando a associação não é concluída.

Risco: baixo; a operação é reversível por novo deploy/commit revert e não remove dados.
