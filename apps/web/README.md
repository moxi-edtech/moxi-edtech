This app is a Next.js project using Supabase Auth with SSR cookies.

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

- In server files, `await cookies()` before passing to `createServerClient`.
- Implement `cookies.get/set/remove` with correct signatures for `@supabase/ssr`.
- Do not call `auth.admin` from the browser; use server routes.

### Email (Onboarding)

- To send branded onboarding emails via Resend, set:
  - `RESEND_API_KEY`
  - `RESEND_FROM` (e.g., `MoxiNexa <no-reply@moxinexa.com>`)
- If not configured, the system falls back to Supabase’s built‑in emails (invite/magic link).

#### SMTP (alternative to Resend)

- Configure these env vars to send via SMTP using Nodemailer:
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` (`true`/`false`)
  - `SMTP_USER`, `SMTP_PASS` (if your SMTP requires auth)
  - `SMTP_FROM` (e.g., `MoxiNexa <no-reply@moxinexa.com>`)
  - Optional DKIM: `SMTP_DKIM_DOMAIN`, `SMTP_DKIM_SELECTOR`, `SMTP_DKIM_KEY`
- If SMTP is set, it is preferred over Resend. If both are absent, the API falls back to Supabase built-in emails.
- Install dependency in this app: `npm i nodemailer`.

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
