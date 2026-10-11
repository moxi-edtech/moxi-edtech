import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { isRefreshTokenNotFoundError } from "../../src/lib/auth/isRefreshTokenNotFoundError";
import { GET as recoverSession } from "../../src/app/auth-recover/route";

const jwtPart = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

test("expired JWT and revoked refresh token reproduce Supabase refresh_token_not_found", async () => {
  // Fully synthetic tokens and an in-memory fake Auth server: no requests to production.
  const expired = [jwtPart({ alg: "HS256", typ: "JWT" }), jwtPart({
    aud: "authenticated",
    role: "authenticated",
    sub: "00000000-0000-4000-8000-000000000099",
    exp: 1_600_000_000,
    iat: 1_599_999_000,
  }), "c2lnbmF0dXJl"].join(".");
  let refreshRequests = 0;
  const supabase = createClient("https://synthetic.supabase.invalid", "synthetic-anon-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (resource: RequestInfo | URL, init?: RequestInit) => {
        const url = String(resource);
        assert.match(url, /\/auth\/v1\/token\?grant_type=refresh_token/);
        assert.match(String(init?.body ?? ""), /revoked-synthetic-token/);
        refreshRequests += 1;
        return new Response(JSON.stringify({
          code: "refresh_token_not_found",
          message: "Invalid Refresh Token: Refresh Token Not Found",
        }), { status: 400, headers: { "Content-Type": "application/json" } });
      },
    },
  });
  const { data, error } = await supabase.auth.setSession({
    access_token: expired,
    refresh_token: "revoked-synthetic-token",
  });
  assert.equal(data.session, null);
  assert.equal(refreshRequests, 1, error?.message ?? "no Supabase error");
  assert.ok(error);
  assert.equal(isRefreshTokenNotFoundError(error), true);
  assert.equal(isRefreshTokenNotFoundError({ message: "temporary upstream timeout", code: "network_error" }), false);
});

test("recovery endpoint clears only auth cookies and redirects once to login", async () => {
  const request = new Request("https://app.klasse.ao/auth-recover?next=/redirect", {
    headers: { cookie: "sb-synthetic-session=expired; klasse_ctx=invalid; analytics_opt=1" },
  });
  const response = await recoverSession(request);
  assert.equal(response.status, 307);
  const destination = new URL(response.headers.get("location")!);
  assert.equal(destination.pathname, "/login");
  assert.equal(destination.searchParams.get("redirect"), "https://app.klasse.ao/redirect");
  const cookies = response.headers.get("set-cookie") ?? "";
  assert.match(cookies, /sb-synthetic-session=/);
  assert.match(cookies, /klasse_ctx=/);
  assert.match(cookies, /Max-Age=0/i);
  assert.match(cookies, /Domain=\.?klasse\.ao/i);
  assert.doesNotMatch(cookies, /analytics_opt=/);
});
