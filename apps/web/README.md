This app is a Next.js project using Supabase Auth with SSR cookies.

## Import Aliases

- `@/*`: local code under `src` (configured in `apps/web/tsconfig.json`).
- `~types/*`: shared types from monorepo `/<root>/types`.

Notes:
- `apps/web/tsconfig.json` extends the root `tsconfig.json`.
- The root `tsconfig` does not define `@/*` to avoid leaking app-specific paths.

## Getting Started

Install dependencies and start dev server:

```bash
npm install
npm run dev
```

Open http://localhost:3000 and try the login flow.

## Auth & Cookies (Supabase)

- Required env vars:
  - `NEXT_PUBLIC_SUPABASE_URL` (public)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public)
  - `SUPABASE_SERVICE_ROLE_KEY` (server-only)

- Login flow:
  - Client posts to `POST /api/auth/login` with email/password.
  - The API uses `@supabase/ssr` with a cookie adapter to persist the session cookies.
  - `/redirect` is an SSR page that reads the session and routes by role.

- Debug endpoint:
  - `GET /api/debug/session` (add `?verbose=1` for extra note)
  - Returns env presence, cookie names, and basic session/user info (no tokens).

## Supabase Health Check

- Single source of truth for envs: use `apps/web/.env.local`. Avoid a root `.env.local` to prevent conflicts.
- Required envs for auth:
  - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public)
  - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
  - Recommended also set `SUPABASE_URL` and `SUPABASE_ANON_KEY` equal to the public ones for server routes.
- Manual health endpoint:
  - `GET /api/health/supabase` returns masked key info, project ref/role, and `/auth/v1/health` status.
- Startup check (instrumentation):
  - On server start, we log a one‑line Supabase auth health summary.
  - Disable with `AUTH_HEALTH_ON_START=0` in `apps/web/.env.local`.
  - For verbose login route logs, set `DEBUG_AUTH=1`.

### Production (Vercel)

- In Project Settings → Environment Variables, add:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- Re-deploy after changes.
- If using auth callbacks, ensure your production URL is configured in Supabase Auth → URL Configuration.

### Production (Render / Others)

- Set the same environment variables for build and runtime.
- Ensure Node 18+ runtime and that env vars are present in runtime.

### Notes

- In server files, call `cookies()` before passing to `createServerClient`.
- Implement `cookies.get/set/remove` with correct signatures for `@supabase/ssr`.
- Do not call `auth.admin` from the browser; use server routes.

### Email (Onboarding)

- To send branded onboarding emails via Resend, set:
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL` (e.g., `MoxiNexa <no-reply@moxinexa.com>`)
- If not configured, the system falls back to Supabase’s built‑in emails (invite/magic link).

#### Branding

- Configure optional branding for email templates via env vars:
  - `BRAND_NAME` (default: `MoxiNexa`)
  - `BRAND_PRIMARY_COLOR` (button color; default: `#2563eb`)
  - `BRAND_LOGO_URL` (absolute URL to logo; optional)
  - `BRAND_SUPPORT_EMAIL` (shown in footer; optional)

#### Email Preview (Debug)

- Endpoint: `GET /api/debug/email?escolaId=...&adminEmail=...&mode=invite|magic`
  - Requires super_admin session.
  - Builds the onboarding email (subject/html/text) without sending.
  - If `adminEmail` is omitted, tries to resolve the first admin of the escola.

## DB migration: numero_login as TEXT

- The login number (`profiles.numero_login`) accepts alphanumeric prefixes (first 3 chars of the escola UUID).
- Ensure the column is `TEXT/VARCHAR` in Postgres. Run the SQL file:
  - Open Supabase Dashboard → SQL Editor.
  - Paste and run `docs/db/2025-09-26-numero_login-text.sql` (path is at repo root).
- This migration:
  - Adds the column if missing and sets its type to `TEXT`.
  - Optionally adds a unique index on `(escola_id, numero_login)` to prevent duplicates.

## DB migration: configuracoes_escola (onboarding preferences)

- The onboarding preferences API expects `public.configuracoes_escola` to exist.
- Run the SQL file at the repository root:
  - Open Supabase Dashboard → SQL Editor.
  - Paste and run `docs/db/2025-09-27-configuracoes_escola.sql`.
  ## DB migration: configuracoes_escola (onboarding preferences)

- The onboarding preferences API expects `public.configuracoes_escola` to exist.
- Run the SQL file at the repository root:
  - Open Supabase Dashboard → SQL Editor.
  - Paste and run `docs/db/2025-09-27-configuracoes_escola.sql`.
  - After running, reload PostgREST cache (Settings → API → Reload) or restart the service.
  - Ensure env vars are set in this app: `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

---

## Storybook

Storybook has been set up for component development and documentation.

### Setup and Configuration

- **Installation**: Storybook packages were manually installed at the monorepo root using `pnpm` to ensure version consistency across all Storybook-related dependencies.
    - `storybook@8.6.15`
    - `@storybook/react@8.6.15`
    - `@storybook/nextjs@8.6.15`
    - `@storybook/addon-links@8.6.15`
    - `@storybook/addon-essentials@8.6.15`
    - `@storybook/addon-interactions@8.6.15`
- **Configuration Files**:
    - `.storybook/main.ts`: Configures story paths, addons (links, essentials, interactions), and specifies `@storybook/nextjs` as the framework.
    - `.storybook/preview.ts`: Sets global parameters like `fullscreen` layout and `controls` matchers, and imports `../src/app/globals.css` to ensure Tailwind CSS and custom fonts (Sora) are loaded.

### Example Stories

Example stories for core components are located in `src/components/`:
- `Card.stories.tsx`: Demonstrates usage of the `Card` component with different metric and financial data.
- `Table.stories.tsx`: Shows a basic table structure and styling.
- `Sidebar.stories.tsx`: Provides an isolated preview of the `Sidebar` navigation component.

### Usage

To run Storybook locally:

```bash
pnpm --filter web storybook
```

To build a static Storybook app:

```bash
pnpm --filter web build-storybook
```

### Conventions

- **Story Location**: Stories are co-located with their respective components (e.g., `src/components/Button.tsx` and `src/components/Button.stories.tsx`).
- **Variants**: Different component states or variations are exported as named stories (e.g., `export const Primary: Story = {...}`).
- **No Business Logic**: Stories should focus solely on component rendering and behavior, without embedding complex business logic.
- **Design Contract**: Storybook serves as a design contract, ensuring consistency, aiding onboarding, and preventing visual regressions. If a component doesn't have a story, it's not considered ready for use.

---

## KLASSE UI Refactoring

A project is underway to refactor UI components to align with the **KLASSE Design System**, an enterprise-grade standard focused on consistency, reusability, and clarity.

### Recent Changes

- **`NoticePanel` Component (`/secretaria/dashboard`)**:
  - The "Avisos Gerais" (General Notices) widget on the Secretaria dashboard has been refactored.
  - The old, yellow-tinted card has been replaced by the new `NoticePanel`, `NoticeItem`, and `EmptyNotices` components.
  - **Standard**: Uses a clean white surface (`bg-white`), with `klasse-gold` as a subtle accent for icons and borders, moving away from distracting background colors.

- **`DashboardHeader` Component**:
  - A standardized internal page header, `DashboardHeader`, has been introduced.
  - It provides a consistent structure for page titles, descriptions, breadcrumbs, and primary/secondary actions.
  - **Implementation**: The Secretaria dashboard (`/secretaria`) is the first page to adopt this new header, creating a clear information hierarchy at the top of the main content area.
  - **Rules**:
    - Primary actions use a solid `klasse-gold` background.
    - Secondary actions use a simple outline style.

This initiative aims to improve UX, establish a clear visual hierarchy, and make the application's UI more professional and scalable.
