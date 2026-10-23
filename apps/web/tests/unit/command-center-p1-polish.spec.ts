import assert from "node:assert/strict";
import test from "node:test";
import { allowRosterRequest } from "../../src/lib/command-center/roster-rate-limit";

const school = "00000000-0000-4000-8000-0000000000a1";
const differentSchool = "00000000-0000-4000-8000-0000000000b2";

test("P1: 30 permitted searches per operator per minute; 31st returns retry-after", () => {
  for (let i = 0; i < 30; i += 1) {
    assert.equal(allowRosterRequest("synthetic-operator-1", school, 1_000).allowed, true);
  }
  const denied = allowRosterRequest("synthetic-operator-1", school, 1_000);
  assert.equal(denied.allowed, false);
  assert.equal(denied.retryAfterSeconds, 60);
  assert.equal(allowRosterRequest("synthetic-operator-1", school, 61_001).allowed, true);
});

test("P1: other operator or school has separate budget", () => {
  for (let i = 0; i < 31; i += 1) allowRosterRequest("synthetic-operator-2", school, 3_000);
  assert.equal(allowRosterRequest("synthetic-operator-2", school, 3_001).allowed, false);
  assert.equal(allowRosterRequest("synthetic-operator-3", school, 3_001).allowed, true);
  assert.equal(allowRosterRequest("synthetic-operator-2", differentSchool, 3_001).allowed, true);
});

test("P1: missing identity is never allowed to consume a shared global bucket", () => {
  assert.equal(allowRosterRequest("",school).allowed,false);
  assert.equal(allowRosterRequest("operator","").allowed,false);
});
