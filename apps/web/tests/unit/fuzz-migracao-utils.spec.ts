import test from "node:test";
import assert from "node:assert/strict";
import { csvToJsonLines, normalizeDateString } from "../../src/app/api/migracao/utils";

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
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[randInt(next, 0, alphabet.length - 1)];
  return out;
}

test("fuzz normalizeDateString em formatos suportados", () => {
  const next = mulberry32(20260324);
  for (let i = 0; i < 800; i++) {
    const year = randInt(next, 2001, 2099);
    const month = randInt(next, 1, 12);
    const day = randInt(next, 1, 28);
    const dd = String(day).padStart(2, "0");
    const mm = String(month).padStart(2, "0");
    const yy = String(year).slice(-2);

    const inputs = [
      `${year}-${mm}-${dd}`,
      `${dd}/${mm}/${year}`,
      `${dd}-${mm}-${year}`,
      `${dd}.${mm}.${year}`,
      `${day}/${month}/${yy}`,
    ];

    for (const input of inputs) {
      const normalized = normalizeDateString(input);
      assert.ok(normalized, `Esperava normalização para ${input}`);
      assert.match(normalized!, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(!Number.isNaN(new Date(normalized!).getTime()));
    }
  }
});

test("fuzz csvToJsonLines preserva cardinalidade para CSV simples", () => {
  const next = mulberry32(20260325);
  for (let i = 0; i < 300; i++) {
    const cols = randInt(next, 2, 7);
    const rows = randInt(next, 1, 45);
    const delimiter = next() > 0.5 ? ";" : ",";
    const headers = Array.from({ length: cols }, (_, idx) => `h${idx}_${randToken(next, 4)}`);

    const lines = [headers.join(delimiter)];
    for (let r = 0; r < rows; r++) {
      const values = Array.from({ length: cols }, () => randToken(next, randInt(next, 1, 10)));
      lines.push(values.join(delimiter));
    }

    const csv = lines.join("\n");
    const parsed = csvToJsonLines(csv);

    assert.equal(parsed.length, rows);
    for (const row of parsed) {
      for (const header of headers) {
        assert.ok(Object.prototype.hasOwnProperty.call(row, header));
      }
    }
  }
});
