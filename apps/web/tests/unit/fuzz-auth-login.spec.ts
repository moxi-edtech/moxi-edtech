import test from "node:test";
import assert from "node:assert/strict";
import { extractLoginCredentials, mapAuthError } from "../../src/lib/auth/loginHardening";

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(next: () => number, min: number, max: number) {
  return Math.floor(next() * (max - min + 1)) + min;
}

function randToken(next: () => number, len: number) {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@._- ";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[randInt(next, 0, alphabet.length - 1)];
  return out;
}

test("fuzz extractLoginCredentials nunca lança e sempre retorna strings", () => {
  const next = mulberry32(20260324);
  const weirdValues: unknown[] = [null, undefined, 0, 1, true, false, [], {}, { nested: { x: 1 } }];

  for (let i = 0; i < 1000; i++) {
    const payload = {
      email: next() > 0.2 ? randToken(next, randInt(next, 0, 40)) : weirdValues[randInt(next, 0, weirdValues.length - 1)],
      password: next() > 0.2 ? randToken(next, randInt(next, 0, 40)) : weirdValues[randInt(next, 0, weirdValues.length - 1)],
      noise: randToken(next, randInt(next, 0, 20)),
    };
    const input = next() > 0.85 ? weirdValues[randInt(next, 0, weirdValues.length - 1)] : payload;
    const parsed = extractLoginCredentials(input);
    assert.equal(typeof parsed.rawIdentifier, "string");
    assert.equal(typeof parsed.password, "string");
    assert.equal(parsed.rawIdentifier, parsed.rawIdentifier.trim());
  }
});

test("mapAuthError respeita mapeamentos principais de auth", () => {
  const cases: Array<{ input: unknown; expectedStatus: number }> = [
    { input: { message: "Email not confirmed" }, expectedStatus: 403 },
    { input: { message: "invalid credentials" }, expectedStatus: 401 },
    { input: { message: "Too many requests", status: 429 }, expectedStatus: 429 },
    { input: { message: "rate limit reached" }, expectedStatus: 429 },
    { input: { message: "erro genérico", status: 500 }, expectedStatus: 500 },
  ];

  for (const c of cases) {
    const out = mapAuthError(c.input);
    assert.equal(out.status, c.expectedStatus);
    assert.ok(out.message.length > 0);
  }
});

test("fuzz mapAuthError mantém status válido e mensagem não vazia", () => {
  const next = mulberry32(20260326);
  for (let i = 0; i < 1000; i++) {
    const maybeStatus = next() > 0.3 ? randInt(next, -50, 999) : randToken(next, randInt(next, 0, 5));
    const maybeMessage = next() > 0.2 ? randToken(next, randInt(next, 0, 60)) : undefined;
    const input: unknown =
      next() > 0.15
        ? { status: maybeStatus, message: maybeMessage }
        : maybeMessage ?? null;

    const out = mapAuthError(input);
    assert.equal(typeof out.status, "number");
    assert.ok(out.status >= 400 && out.status <= 599);
    assert.equal(typeof out.message, "string");
    assert.ok(out.message.length > 0);
  }
});
