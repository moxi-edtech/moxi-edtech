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
