# Super Admin Entrypoints Map

Scope: `apps/web/src/app/super-admin/**`

## Layout Contract

All route pages below are nested under `apps/web/src/app/super-admin/layout.tsx`, which wraps children with:
- `AppShell`
- `RequireSuperAdmin`

No page now composes `PortalLayout`, `components/super-admin/Header.tsx`, or `components/super-admin/Sidebar.tsx`.

## Entrypoints

| Route | File | Status |
|---|---|---|
| `/super-admin` | `apps/web/src/app/super-admin/page.tsx` | ✅ covered by layout |
| `/super-admin/dashboard` | `apps/web/src/app/super-admin/dashboard/page.tsx` | ✅ covered by layout |
| `/super-admin/escolas` | `apps/web/src/app/super-admin/escolas/page.tsx` | ✅ covered by layout |
| `/super-admin/escolas/nova` | `apps/web/src/app/super-admin/escolas/nova/page.tsx` | ✅ covered by layout |
| `/super-admin/escolas/[id]` | `apps/web/src/app/super-admin/escolas/[id]/page.tsx` | ✅ covered by layout |
| `/super-admin/escolas/[id]/edit` | `apps/web/src/app/super-admin/escolas/[id]/edit/page.tsx` | ✅ covered by layout |
| `/super-admin/usuarios` | `apps/web/src/app/super-admin/usuarios/page.tsx` | ✅ covered by layout |
| `/super-admin/usuarios/novo` | `apps/web/src/app/super-admin/usuarios/novo/page.tsx` | ✅ covered by layout |
| `/super-admin/health` | `apps/web/src/app/super-admin/health/page.tsx` | ✅ covered by layout |
| `/super-admin/diagnostics` | `apps/web/src/app/super-admin/diagnostics/page.tsx` | ✅ covered by layout |
| `/super-admin/onboarding` | `apps/web/src/app/super-admin/onboarding/page.tsx` | ✅ covered by layout |
| `/super-admin/cobrancas` | `apps/web/src/app/super-admin/cobrancas/page.tsx` | ✅ covered by layout |
| `/super-admin/centros-formacao` | `apps/web/src/app/super-admin/centros-formacao/page.tsx` | ✅ covered by layout |
| `/super-admin/centros-formacao/novo` | `apps/web/src/app/super-admin/centros-formacao/novo/page.tsx` | ✅ covered by layout |
| `/super-admin/debug` | `apps/web/src/app/super-admin/debug/page.tsx` | ✅ covered by layout |
| `/super-admin/debug/email-preview` | `apps/web/src/app/super-admin/debug/email-preview/page.tsx` | ✅ covered by layout |
| `/super-admin/fluxos/criacao-admin` | `apps/web/src/app/super-admin/fluxos/criacao-admin/page.tsx` | ✅ covered by layout |
| `/super-admin/nova` | `apps/web/src/app/super-admin/nova/page.tsx` (redirect) | ✅ covered by layout |

## Visual Regression Checklist (mínimo)

Use this checklist in QA for each key Super Admin page (`/super-admin`, `/super-admin/escolas`, `/super-admin/usuarios`, `/super-admin/health`):

- [ ] Sidebar width expanded = **256px**.
- [ ] Sidebar width collapsed = **80px**.
- [ ] Sidebar active item style persists (`bg-slate-900`, gold emphasis) after route changes.
- [ ] Header/topbar remains visually fixed while content scrolls.
- [ ] Main content container keeps responsive grid consistency with other portals:
  - mobile: `grid-cols-1`
  - tablet/desktop transitions match existing sections (`md:*`, `lg:*` breakpoints)
- [ ] No duplicated header/sidebar rendered by route page itself.
- [ ] No full-screen wrappers in page content (`h-screen`) that break shared shell scroll behavior.
