import assert from "node:assert/strict";
import test from "node:test";
import { buildAiRuntimeConfig, buildFollowUpDelaysMs, followUpHoursFromEnv } from "./runtime-policy.mjs";

const HOUR_MS = 60 * 60 * 1000;

test("first follow-up respects FOLLOWUP_AFTER_HOURS", () => {
  assert.equal(followUpHoursFromEnv("24"), 24);
  const delays = buildFollowUpDelaysMs("24");
  assert.equal(delays[0], 24 * HOUR_MS);
  assert.equal(delays[1], 48 * HOUR_MS);
  assert.equal(delays[2], 72 * HOUR_MS);
});

test("later stages never shorten a custom initial delay", () => {
  const delays = buildFollowUpDelaysMs("60");
  assert.equal(delays[0], 60 * HOUR_MS);
  assert.ok(delays.slice(1).every((delay) => delay >= delays[0]));
});

test("AI runtime keeps an independently configured fallback", () => {
  const config = buildAiRuntimeConfig({
    AI_PROVIDER: "deepseek",
    AI_API_KEY: "primary-placeholder",
    AI_MODEL: "deepseek-chat",
    AI_FALLBACK_PROVIDER: "gemini",
    AI_FALLBACK_API_KEY: "fallback-placeholder",
    AI_FALLBACK_MODEL: "gemini-2.5-flash",
  });
  assert.equal(config.provider, "deepseek");
  assert.equal(config.fallbackProvider, "gemini");
  assert.equal(config.fallbackModel, "gemini-2.5-flash");
});
