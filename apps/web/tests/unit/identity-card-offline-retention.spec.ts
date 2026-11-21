import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  IDENTITY_CARD_CACHE_TTL_MS,
  identityCardCacheKey,
  pruneIdentityCardCache,
  readIdentityCardCache,
  saveIdentityCardCache,
} from "../../src/lib/offline/identity-card-cache";

function makeStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    clear() { values.clear(); },
  };
}

const now = Date.parse("2026-11-21T12:00:00.000Z");
const card = {
  nome: "Aluno Teste", processo: "123", escola: "Escola Teste",
  curso: "EP", turma: "6ª A", ano_letivo: 2026,
  validade: "2027-08-31",
  verification_url: "https://www.klasse.ao/verificar/codigo-teste",
};
const id = (userId: string, escolaId: string, studentId: string | null) =>
  identityCardCacheKey({userId, escolaId, studentId});

test("cache v3 exige conta, tenant e educando explícito", () => {
  assert.equal(id("", "escola", "aluno"), null);
  assert.equal(id("user", "", "aluno"), null);
  assert.equal(id("user", "escola", null), null);
  assert.notEqual(id("user-a", "escola", "aluno"), id("user-b", "escola", "aluno"));
  assert.notEqual(id("user", "escola-a", "aluno"), id("user", "escola-b", "aluno"));
  assert.notEqual(id("user", "escola", "aluno-a"), id("user", "escola", "aluno-b"));
});

test("retém apenas campos mínimos, sem BI, fotografia nem atributos estranhos", () => {
  const storage = makeStorage();
  const key = id("u", "e", "a")!;
  assert.equal(saveIdentityCardCache(storage, key, {
    ...card, bi: "999", foto: "https://privado/foto", dados_sensiveis: "segredo",
  } as typeof card, now), true);
  const raw = storage.getItem(key)!;
  assert.ok(raw.includes("Aluno Teste"));
  assert.ok(!raw.includes("999"));
  assert.ok(!raw.includes("foto"));
  assert.ok(!raw.includes("segredo"));
  assert.deepEqual(readIdentityCardCache(storage, key, now + 1000), card);
});

test("expira em 24h mesmo com cartão oficial válido por mais tempo", () => {
  const storage = makeStorage();
  const key = id("u", "e", "a")!;
  assert.equal(IDENTITY_CARD_CACHE_TTL_MS, 86_400_000);
  saveIdentityCardCache(storage, key, card, now);
  assert.ok(readIdentityCardCache(storage, key, now + IDENTITY_CARD_CACHE_TTL_MS - 1));
  assert.equal(readIdentityCardCache(storage, key, now + IDENTITY_CARD_CACHE_TTL_MS), null);
  assert.equal(storage.getItem(key), null);
});

test("validade do documento vence antes do TTL; cartão expirado não é cacheado", () => {
  const storage = makeStorage();
  const key = id("u", "e", "a")!;
  const untilToday = {...card, validade: "2026-11-21"};
  assert.equal(saveIdentityCardCache(storage, key, untilToday, now), true);
  assert.ok(readIdentityCardCache(storage, key, Date.parse("2026-11-21T23:50:00Z")));
  assert.equal(readIdentityCardCache(storage, key, Date.parse("2026-11-22T00:00:00Z")), null);
  assert.equal(saveIdentityCardCache(storage, key, {...card, validade: "2026-11-20"}, now), false);
});

test("corrupção, cache antigo e manipulação de expiração falham fechados", () => {
  const storage = makeStorage();
  const key = id("u", "e", "a")!;
  storage.setItem(key, "{");
  assert.equal(readIdentityCardCache(storage, key, now), null);
  saveIdentityCardCache(storage, key, card, now);
  const parsed = JSON.parse(storage.getItem(key)!) as {expiresAt:number};
  parsed.expiresAt += IDENTITY_CARD_CACHE_TTL_MS;
  storage.setItem(key, JSON.stringify(parsed));
  assert.equal(readIdentityCardCache(storage, key, now), null);
  storage.setItem("klasse_id_card_cache_default", JSON.stringify(card));
  storage.setItem("klasse_id_card_cache_v2:u:e:a", JSON.stringify(card));
  pruneIdentityCardCache(storage, now);
  assert.equal(storage.getItem("klasse_id_card_cache_default"), null);
  assert.equal(storage.getItem("klasse_id_card_cache_v2:u:e:a"), null);
});

test("logout explícito e eventos Auth limpam identidade em qualquer aba", () => {
  const logout = readFileSync(new URL("../../src/components/auth/SignOutButton.tsx", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../../src/app/(portal-aluno)/aluno/AlunoLayoutClient.tsx", import.meta.url), "utf8");
  assert.match(logout, /clearIdentityCardCache\(\)/);
  assert.match(layout, /event === "SIGNED_OUT"/);
  assert.match(layout, /session\?\.user\.id !== userId/);
  assert.match(layout, /clearIdentityCardCache\(\)/);
  assert.match(logout, /clearOfflineData\(\)/);
  assert.match(logout, /CLEAR_DATA_CACHE/);
});
