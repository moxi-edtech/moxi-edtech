import test from "node:test";
import assert from "node:assert/strict";
import { getOfficialRaaPublicationAt } from "../../src/lib/academico/raa-pauta-publication";

const generated = "2026-10-30T12:00:00Z";
const completed = "2026-10-30T12:03:00Z";
const valid = { status: "SUCCESS", pdf_path: "school/term.pdf", generated_at: generated, updated_at: completed };

test("unpublished/failed/processing pauta cannot start the 48-hour appeal clock", () => {
  assert.equal(getOfficialRaaPublicationAt({ ...valid, status: "PROCESSING" }), null);
  assert.equal(getOfficialRaaPublicationAt({ ...valid, status: "FAILED" }), null);
  assert.equal(getOfficialRaaPublicationAt({ ...valid, pdf_path: "" }), null);
  assert.equal(getOfficialRaaPublicationAt({ ...valid, updated_at: "bad" }), null);
  assert.equal(getOfficialRaaPublicationAt(null), null);
});
test("completed pauta uses the completion timestamp (never an earlier generation timestamp)", () => {
  assert.equal(getOfficialRaaPublicationAt(valid)?.toISOString(), completed.replace("Z", ".000Z"));
  assert.equal(getOfficialRaaPublicationAt({ ...valid, generated_at: completed, updated_at: generated })?.toISOString(), completed.replace("Z", ".000Z"));
});
