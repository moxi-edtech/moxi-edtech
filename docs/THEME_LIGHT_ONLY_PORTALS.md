# Theme policy — portals without a theme selector

Until student and teacher portals receive a reviewed theme switcher, all routes under
`/aluno`, `/professor`, `/escola/{id}/aluno` and `/escola/{id}/professor`
**always render in light mode**, regardless of the saved preference or OS color scheme.

The rule is applied twice: the root HTML bootstrap script before first paint and the
client ThemeProvider on route transitions. This prevents dark flashes and preserves the
previous `klasse-theme` preference for administrative/financial/secretary portals.
It does not modify the stored setting while visiting the student/teacher portals.

The shared Topbar hides both quick ThemeToggle and the appearance menu in those two
portals. Student and teacher routes outside the canonical school prefix are covered as
well; similarly named management routes such as `/escola/{id}/professores` are **not**
restricted. Routes that later implement a tested Theme Switcher can remove their policy
entry as an explicit feature change.

Regression tests: `pnpm --filter web test:unit:theme` and
`node --test apps/web/tests/unit/theme-portal-isolation.spec.mjs` in the Theme Switcher Guard workflow.
