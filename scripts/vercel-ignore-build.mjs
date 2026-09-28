#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const PROJECTS = {
  web: "prj_YjDBpI3emmjWUB5cF7K7IsV7oNFg",
  landing: "prj_lY3RakaNlNRcimyoYBvn93EIFHfd",
  auth: "prj_V5wrRepbX1kL1ORK11IWFCNoIkCS",
  formacao: "prj_ot82tsIydCJZyTjyPIh9QeAH5bGF",
};

const LEGACY_WEB_PROJECTS = new Set([
  "prj_GOEeUzakrO2xL8Xwe53sE9pGlVgH",
  "prj_QFMb6w6U3sxMcUD84l8d3Bi0xC3D",
  "prj_C78hac3OoFeNzH06wSsMsdWoQAf9",
]);

const COMMON_EXACT = new Set([
  ".npmrc",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "tsconfig.base.json",
  "vercel.json",
  "scripts/vercel-ignore-build.mjs",
]);

const COMMON_PREFIXES = ["packages/", "types/"];

const RULES = {
  web: {
    exact: new Set([
      "apps/web/package.json",
      "apps/web/next.config.ts",
      "apps/web/tsconfig.json",
      "apps/web/postcss.config.js",
      "apps/web/postcss.config.mjs",
      "apps/web/vercel.json",
    ]),
    prefixes: ["apps/web/src/", "apps/web/public/"],
  },
  landing: {
    exact: new Set(["apps/landing/package.json", "apps/landing/vercel.json"]),
    prefixes: ["apps/landing/"],
  },
  auth: {
    exact: new Set(["apps/auth/package.json", "apps/auth/vercel.json"]),
    prefixes: ["apps/auth/"],
  },
  formacao: {
    exact: new Set(["apps/formacao/package.json", "apps/formacao/vercel.json"]),
    prefixes: ["apps/formacao/"],
  },
};

function failOpen(message) {
  console.error(`[vercel-ignore] ${message}; proceeding with build`);
  process.exit(1);
}

function git(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function isRelevant(path, rule) {
  if (COMMON_EXACT.has(path)) return true;
  if (COMMON_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;
  if (rule.exact.has(path)) return true;
  return rule.prefixes.some((prefix) => path.startsWith(prefix));
}

const projectId = process.env.VERCEL_PROJECT_ID;
const branch = process.env.VERCEL_GIT_COMMIT_REF || "";

if (!projectId) failOpen("VERCEL_PROJECT_ID is missing");

let projectKind = Object.entries(PROJECTS).find(([, id]) => id === projectId)?.[0];

if (!projectKind && LEGACY_WEB_PROJECTS.has(projectId)) {
  if (branch && branch !== "main") {
    console.log(
      `[vercel-ignore] skipping legacy web preview project ${projectId} on branch ${branch}`
    );
    process.exit(0);
  }
  projectKind = "web";
}

if (!projectKind) {
  failOpen(`unknown project id ${projectId}`);
}

try {
  const repoRoot = git(["rev-parse", "--show-toplevel"], process.cwd());
  const head = process.env.VERCEL_GIT_COMMIT_SHA || "HEAD";
  let base = process.env.VERCEL_GIT_PREVIOUS_SHA || "";

  if (!base || /^0+$/.test(base)) {
    base = `${head}^`;
  }

  git(["rev-parse", "--verify", head], repoRoot);
  git(["rev-parse", "--verify", base], repoRoot);

  const output = git(["diff", "--name-only", base, head], repoRoot);
  const changed = output ? output.split("\n").filter(Boolean) : [];
  const rule = RULES[projectKind];
  const relevant = changed.filter((path) => isRelevant(path, rule));

  if (relevant.length === 0) {
    console.log(
      `[vercel-ignore] skipping ${projectKind}: no deploy-relevant files changed between ${base} and ${head}`
    );
    process.exit(0);
  }

  console.log(
    `[vercel-ignore] building ${projectKind}; relevant changes: ${relevant.slice(0, 20).join(", ")}`
  );
  process.exit(1);
} catch (error) {
  failOpen(error instanceof Error ? error.message : String(error));
}
