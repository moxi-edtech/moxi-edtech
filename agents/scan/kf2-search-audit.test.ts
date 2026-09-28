import assert from "node:assert/strict";
import test from "node:test";

import { checkFile, extractQuerySegments } from "./kf2-search-audit-core";

const route = (body: string) => `export async function GET() {\n${body}\n}`;

test("ignores Buffer.from and Array.from false positives", () => {
  const content = route(`
    const encoded = Buffer.from("abc", "utf8").toString("base64");
    const ids = Array.from(new Set(["a", "b"]));
    return Response.json({ encoded, ids });
  `);

  assert.equal(extractQuerySegments(content).length, 0);
  assert.deepEqual(checkFile("apps/web/src/app/api/auth/handoff/route.ts", content), []);
});

test("ignores non-read from chains", () => {
  const content = route(`
    await supabase.from("audit_logs").update({ seen: true }).eq("id", "1");
    return Response.json({ ok: true });
  `);

  assert.deepEqual(checkFile("apps/web/src/app/api/example/route.ts", content), []);
});

test("keeps bounded and ordered Supabase reads green", () => {
  const content = route(`
    const { data } = await supabase
      .from("alunos")
      .select("id,nome")
      .order("id", { ascending: true })
      .limit(50);
    return Response.json({ data });
  `);

  assert.deepEqual(checkFile("apps/web/src/app/api/alunos/route.ts", content), []);
});

test("still flags a real unbounded unordered Supabase read", () => {
  const content = route(`
    const { data } = await supabase
      .from("alunos")
      .select("id,nome");
    return Response.json({ data });
  `);

  assert.deepEqual(checkFile("apps/web/src/app/api/alunos/route.ts", content), [
    { file: "apps/web/src/app/api/alunos/route.ts", error: "Pesquisa sem LIMIT explícito" },
    { file: "apps/web/src/app/api/alunos/route.ts", error: "Pesquisa sem ORDER BY determinístico" },
  ]);
});

test("still audits RPC list calls", () => {
  const content = route(`
    const { data } = await supabase.rpc("list_alunos", { p_escola_id: "school" });
    return Response.json({ data });
  `);

  assert.deepEqual(checkFile("apps/web/src/app/api/alunos/search/route.ts", content), [
    { file: "apps/web/src/app/api/alunos/search/route.ts", error: "Pesquisa sem LIMIT explícito" },
    { file: "apps/web/src/app/api/alunos/search/route.ts", error: "Pesquisa sem ORDER BY determinístico" },
  ]);
});

test("single-row reads remain exempt from list invariants", () => {
  const content = route(`
    const { data } = await supabase
      .from("alunos")
      .select("id,nome")
      .eq("id", "student")
      .maybeSingle();
    return Response.json({ data });
  `);

  assert.deepEqual(checkFile("apps/web/src/app/api/alunos/[id]/route.ts", content), []);
});
