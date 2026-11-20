import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyPasswordSignInError } from "../../lib/passwordSignInError";

test("Supabase 504 / upstream errors must not be reported as invalid credentials", () => {
  for (const error of [
    { status: 504, code: "request_timeout", message: "context deadline exceeded" },
    { status: 502, message: "bad gateway" },
    { status: 503, message: "service unavailable" },
    { status: 408, message: "request timeout" },
    { status: 400, code: "unknown_auth_failure" },
    { message: "fetch failed" },
    null,
  ]) {
    assert.equal(classifyPasswordSignInError(error), "unavailable");
  }
});

test("Only explicit invalid-credential errors permit candidate email fallback", () => {
  for (const error of [
    { status: 400, code: "invalid_credentials" },
    { status: 400, message: "Invalid login credentials" },
    { status: 422, code: "invalid_login_credentials" },
  ]) {
    assert.equal(classifyPasswordSignInError(error), "invalid_credentials");
  }
});

test("Preserve rate-limit and unconfirmed-email outcomes", () => {
  assert.equal(classifyPasswordSignInError({ status: 429 }), "rate_limited");
  assert.equal(classifyPasswordSignInError({ code: "over_request_rate_limit" }), "rate_limited");
  assert.equal(classifyPasswordSignInError({ code: "email_not_confirmed" }), "email_unconfirmed");
});
