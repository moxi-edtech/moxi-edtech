import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd(), "../..");

test("browser Supabase client keeps the SSR cookie adapter", () => {
  const source = fs.readFileSync(
    path.join(repoRoot, "apps/web/src/lib/supabaseClient.ts"),
    "utf8"
  );

  assert.match(source, /createBrowserClient/);
  assert.doesNotMatch(source, /No-op for localStorage/);
  assert.doesNotMatch(source, /storage:\s*typeof window/);
});

test("logout clears shared auth cookies server-side", () => {
  const source = fs.readFileSync(
    path.join(repoRoot, "apps/web/src/app/api/auth/logout/route.ts"),
    "utf8"
  );

  assert.match(source, /klasse_ctx/);
  assert.match(source, /\.klasse\.ao/);
  assert.match(source, /appendExpireResponseCookie/);
});

test("topbar logout uses the server cookie cleanup route", () => {
  const source = fs.readFileSync(
    path.join(repoRoot, "apps/web/src/components/auth/SignOutButton.tsx"),
    "utf8"
  );

  assert.match(source, /signOut\(\{ scope: ['"]local['"] \}\)/);
  assert.match(source, /\/api\/auth\/logout/);
});


test("portal guards keep one browser Supabase client across renders", () => {
  for (const guard of ["RequireSecretaria.tsx", "RequireAdmin.tsx", "RequireFinanceiro.tsx"]) {
    const source = fs.readFileSync(
      path.join(repoRoot, "apps/web/src/app/(guards)", guard),
      "utf8"
    );

    assert.match(source, /useMemo\(\(\) => createClient\(\), \[\]\)/);
    assert.doesNotMatch(source, /const supabase = createClient\(\);/);
  }
});
