import test from "node:test";
import assert from "node:assert/strict";
import { getLuandaDayBounds } from "../../src/lib/secretaria/luanda-day";

test("o dia civil em Luanda começa às 23h UTC do dia anterior", () => {
  assert.deepEqual(getLuandaDayBounds(new Date("2026-11-18T23:00:00.000Z")), {
    startUtc: "2026-11-18T23:00:00.000Z",
    endUtc: "2026-11-19T23:00:00.000Z",
  });
});

test("um segundo antes da meia-noite de Luanda pertence ao dia anterior", () => {
  assert.deepEqual(getLuandaDayBounds(new Date("2026-11-18T22:59:59.999Z")), {
    startUtc: "2026-11-17T23:00:00.000Z",
    endUtc: "2026-11-18T23:00:00.000Z",
  });
});

test("a virada de ano civil em Angola mantém intervalo de 24 horas", () => {
  assert.deepEqual(getLuandaDayBounds(new Date("2026-12-31T23:05:00.000Z")), {
    startUtc: "2026-12-31T23:00:00.000Z",
    endUtc: "2027-01-01T23:00:00.000Z",
  });
});
