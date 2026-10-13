import assert from "node:assert/strict";
import test from "node:test";

import {
  AGT_CERTIFICATION_PLAN,
  AGT_CERTIFICATION_REQUIRED_FE_SERIES,
  AGT_CERTIFICATION_REQUIRED_LOCAL_SERIES,
  requiredFeSeriesTypes,
  resolveP09Window,
} from "../../src/lib/fiscal/agtCertificationPlan";

test("certification plan covers P01 through P17 exactly once", () => {
  assert.deepEqual(
    AGT_CERTIFICATION_PLAN.map((item) => item.point),
    Array.from({ length: 17 }, (_, index) =>
      `P${String(index + 1).padStart(2, "0")}`
    )
  );
});

test("certification preflight keeps work/movement series local and FE series provisioned", () => {
  assert.deepEqual(
    [...AGT_CERTIFICATION_REQUIRED_LOCAL_SERIES],
    ["PP", "GR", "GT"]
  );
  assert.deepEqual(
    [...AGT_CERTIFICATION_REQUIRED_FE_SERIES],
    ["FT", "NC", "ND", "RC", "FG"]
  );
  assert.deepEqual(
    requiredFeSeriesTypes({ includeRe: true }),
    ["FT", "NC", "ND", "RC", "FG", "RE"]
  );
});

test("P13 remains an N/A candidate instead of inventing auto-faturacao support", () => {
  const p13 = AGT_CERTIFICATION_PLAN.find((item) => item.point === "P13");
  assert.equal(p13?.execution, "na-candidate");
  assert.deepEqual(p13?.documentTypes, []);
});

test("P09 uses the real Africa/Luanda clock and refuses times at or after 10h", () => {
  const eligible = resolveP09Window(new Date("2026-09-28T07:30:00Z"));
  assert.equal(eligible.localTime, "08:30:00");
  assert.equal(eligible.eligible, true);

  const closed = resolveP09Window(new Date("2026-09-28T09:00:00Z"));
  assert.equal(closed.localTime, "10:00:00");
  assert.equal(closed.eligible, false);
});
