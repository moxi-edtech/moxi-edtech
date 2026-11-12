import assert from "node:assert/strict";
import test from "node:test";

import {
  addExact,
  equalRounded,
  exactToFixed,
  exactToJsonNumber,
  mulExact,
  parseExactDecimal,
  roundExact,
  subExact,
} from "../../src/lib/fiscal/decimal";

test("exact decimal avoids IEEE-754 drift for decimal addition", () => {
  const total = addExact(parseExactDecimal("0.1"), parseExactDecimal("0.2"));
  assert.equal(exactToFixed(total, 2), "0.30");
});

test("exact decimal preserves four-decimal unit prices", () => {
  const quantity = parseExactDecimal("3");
  const price = parseExactDecimal("33.3333");
  const gross = mulExact(quantity, price);
  assert.equal(exactToFixed(gross, 4), "99.9999");
  assert.equal(exactToFixed(roundExact(gross, 2), 2), "100.00");
});

test("exact decimal settlement arithmetic is stable", () => {
  const quantity = parseExactDecimal("3");
  const base = parseExactDecimal("33.3333");
  const unit = parseExactDecimal("30.0000");
  const settlement = mulExact(quantity, subExact(base, unit));
  assert.equal(exactToFixed(settlement, 4), "9.9999");
  assert.equal(exactToFixed(roundExact(settlement, 2), 2), "10.00");
});

test("exact decimal rounds half-up deterministically", () => {
  assert.equal(exactToFixed(roundExact(parseExactDecimal("23.144"), 2), 2), "23.14");
  assert.equal(exactToFixed(roundExact(parseExactDecimal("23.145"), 2), 2), "23.15");
  assert.equal(exactToFixed(roundExact(parseExactDecimal("23.146"), 2), 2), "23.15");
});

test("rounded comparison is exact at the requested scale", () => {
  assert.equal(
    equalRounded(parseExactDecimal("113.9900"), parseExactDecimal("113.99"), 2),
    true
  );
  assert.equal(
    equalRounded(parseExactDecimal("113.99"), parseExactDecimal("114.00"), 2),
    false
  );
});

test("JSON numeric conversion happens only after exact arithmetic", () => {
  const exact = addExact(parseExactDecimal("12.60"), parseExactDecimal("90.00"));
  assert.equal(exactToJsonNumber(exact, 2), 102.6);
});
