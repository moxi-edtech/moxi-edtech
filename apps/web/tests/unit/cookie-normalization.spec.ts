import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSupabaseAuthCookies } from "../../../../packages/auth-middleware/src/index";

test("normalizeSupabaseAuthCookies - base empty + valid chunks (reconstructs from chunks)", () => {
  const cookies = [
    { name: "sb-<project-ref>-auth-token", value: "" },
    { name: "sb-<project-ref>-auth-token.0", value: "chunk0" },
    { name: "sb-<project-ref>-auth-token.1", value: "chunk1" },
  ];

  const result = normalizeSupabaseAuthCookies(cookies);

  // Deve conter a reconstrução e remover os chunks
  const normalizedBase = result.find(c => c.name === "sb-<project-ref>-auth-token");
  assert.ok(normalizedBase, "Deve conter o cookie base");
  assert.equal(normalizedBase.value, "chunk0chunk1");

  const chunk0 = result.find(c => c.name === "sb-<project-ref>-auth-token.0");
  assert.equal(chunk0, undefined, "Chunks devem ser removidos do array final");
});

test("normalizeSupabaseAuthCookies - base valid + old chunks (uses base, ignores old chunks)", () => {
  const cookies = [
    { name: "sb-<project-ref>-auth-token", value: "validbase" },
    { name: "sb-<project-ref>-auth-token.0", value: "oldchunk0" },
    { name: "sb-<project-ref>-auth-token.1", value: "oldchunk1" },
  ];

  const result = normalizeSupabaseAuthCookies(cookies);

  const normalizedBase = result.find(c => c.name === "sb-<project-ref>-auth-token");
  assert.ok(normalizedBase, "Deve conter o cookie base");
  assert.equal(normalizedBase.value, "validbase");

  const chunk0 = result.find(c => c.name === "sb-<project-ref>-auth-token.0");
  assert.equal(chunk0, undefined, "Chunks devem ser removidos do array final");
});

test("normalizeSupabaseAuthCookies - chunks with gap .0/.2 (invalid chunks, keeps base empty)", () => {
  const cookies = [
    { name: "sb-<project-ref>-auth-token", value: "" },
    { name: "sb-<project-ref>-auth-token.0", value: "chunk0" },
    { name: "sb-<project-ref>-auth-token.2", value: "chunk2" },
  ];

  const result = normalizeSupabaseAuthCookies(cookies);

  const normalizedBase = result.find(c => c.name === "sb-<project-ref>-auth-token");
  assert.ok(normalizedBase, "Deve manter o cookie base");
  assert.equal(normalizedBase.value, "", "Não deve reconstruir de chunks com gaps");
});

test("normalizeSupabaseAuthCookies - apenas base (keeps base as is)", () => {
  const cookies = [
    { name: "sb-<project-ref>-auth-token", value: "justbase" },
  ];

  const result = normalizeSupabaseAuthCookies(cookies);

  const normalizedBase = result.find(c => c.name === "sb-<project-ref>-auth-token");
  assert.ok(normalizedBase);
  assert.equal(normalizedBase.value, "justbase");
});

test("normalizeSupabaseAuthCookies - apenas chunks (reconstructs from chunks)", () => {
  const cookies = [
    { name: "sb-<project-ref>-auth-token.0", value: "chunk0" },
    { name: "sb-<project-ref>-auth-token.1", value: "chunk1" },
  ];

  const result = normalizeSupabaseAuthCookies(cookies);

  const normalizedBase = result.find(c => c.name === "sb-<project-ref>-auth-token");
  assert.ok(normalizedBase, "Deve criar o cookie base mesmo que não estivesse presente inicialmente");
  assert.equal(normalizedBase.value, "chunk0chunk1");
});
