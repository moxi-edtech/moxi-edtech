#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const RELEVANT_EXACT = new Set([
  ".github/workflows/kf2-search-audit.yml",
  ".npmrc",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "tsconfig.base.json",
  "scripts/kf2-path-filter.mjs",
  "scripts/kf2-path-filter.test.mjs",
]);

const RELEVANT_PREFIXES = [
  "apps/web/",
  "packages/",
  "types/",
  "supabase/",
  "agents/",
];

const PR132_VERCEL_ONLY = new Set([
  "vercel.json",
  "apps/web/vercel.json",
  "apps/auth/vercel.json",
  "apps/formacao/vercel.json",
  "apps/landing/vercel.json",
  "scripts/vercel-ignore-build.mjs",
]);

const KNOWN_IRRELEVANT_PREFIXES = [
  "apps/auth/",
  "apps/formacao/",
  "apps/landing/",
  "docs/",
];

export function isKf2RelevantPath(file) {
  if (PR132_VERCEL_ONLY.has(file)) return false;
  if (RELEVANT_EXACT.has(file)) return true;
  if (RELEVANT_PREFIXES.some((prefix) => file.startsWith(prefix))) return true;
  if (KNOWN_IRRELEVANT_PREFIXES.some((prefix) => file.startsWith(prefix))) return false;
  if (/^[^/]+\.md$/i.test(file)) return false;

  // Unknown paths fail open so a new root/app/config area cannot silently bypass KF2.
  return true;
}

export function shouldRunKf2(changedFiles) {
  if (changedFiles.length === 0) return true;
  return changedFiles.some(isKf2RelevantPath);
}

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function writeOutput(key, value) {
  const output = process.env.GITHUB_OUTPUT;
  if (output) {
    fs.appendFileSync(output, `${key}=${value}\n`, "utf8");
  }
}

function failOpen(message) {
  console.error(`[kf2-paths] ${message}; running KF2 (fail-open)`);
  writeOutput("run", "true");
  writeOutput("reason", "filter-error-fail-open");
  process.exit(0);
}

function resolveRange() {
  const eventName = process.env.GITHUB_EVENT_NAME || "";
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const event =
    eventPath && fs.existsSync(eventPath)
      ? JSON.parse(fs.readFileSync(eventPath, "utf8"))
      : {};

  if (eventName === "pull_request" && event.pull_request) {
    return {
      base: event.pull_request.base?.sha,
      head: event.pull_request.head?.sha,
    };
  }

  if (eventName === "push") {
    return {
      base: event.before,
      head: event.after || process.env.GITHUB_SHA,
    };
  }

  return null;
}

export function main() {
  try {
    const range = resolveRange();
    if (!range) {
      console.log("[kf2-paths] unsupported/manual event; running KF2");
      writeOutput("run", "true");
      writeOutput("reason", "event-fail-open");
      return;
    }

    const { base, head } = range;
    if (!base || !head || /^0+$/.test(base) || /^0+$/.test(head)) {
      failOpen("missing/zero comparison SHA");
      return;
    }

    git(["rev-parse", "--verify", base]);
    git(["rev-parse", "--verify", head]);
    const output = git(["diff", "--name-only", base, head]);
    const changedFiles = output ? output.split("\n").filter(Boolean) : [];
    const relevant = changedFiles.filter(isKf2RelevantPath);
    const run = shouldRunKf2(changedFiles);

    console.log(`[kf2-paths] changed=${changedFiles.length}; relevant=${relevant.length}`);
    if (changedFiles.length <= 30) {
      console.log(`[kf2-paths] files=${changedFiles.join(", ") || "(none)"}`);
    }
    if (relevant.length <= 30) {
      console.log(`[kf2-paths] relevant=${relevant.join(", ") || "(none)"}`);
    }

    writeOutput("run", run ? "true" : "false");
    writeOutput("reason", run ? "relevant-change" : "unrelated-monorepo-change");
  } catch (error) {
    failOpen(error instanceof Error ? error.message : String(error));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
