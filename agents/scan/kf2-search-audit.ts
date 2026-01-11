import fg from "fast-glob";
import fs from "fs";

const SEARCH_FILES = [
  "apps/web/src/app/api/**/search*/**/*.ts",
  "apps/web/src/app/api/**/route.ts",
  "apps/web/src/lib/**/search*.ts",
];

const MAX_LIMIT = 50;

type Finding = {
  file: string;
  error: string;
};

const findings: Finding[] = [];

function hasAllowScan(content: string) {
  return content.includes("@kf2 allow-scan");
}

function hasKf2Invariants(content: string) {
  return content.includes("applyKf2ListInvariants");
}

function checkFile(file: string, content: string) {
  if (hasAllowScan(content)) {
    return;
  }

  if (file.includes("/app/api/") || file.includes("\\app\\api\\")) {
    const hasGetHandler =
      content.includes("export async function GET") ||
      content.includes("export function GET") ||
      content.includes("export const GET");
    if (!hasGetHandler) {
      return;
    }
  }

  const hasQuery = content.includes(".from(") || content.includes(".rpc(");
  if (!hasQuery) {
    return;
  }

  if (content.includes(".select('*')") || content.includes('.select("*")')) {
    findings.push({
      file,
      error: "Uso de select('*') em pesquisa",
    });
  }

  const limitRegex = /\.limit\((\d+)\)/g;
  const limits = [...content.matchAll(limitRegex)];
  const usesKf2Invariants = hasKf2Invariants(content);

  if (!usesKf2Invariants) {
    if (limits.length === 0) {
      findings.push({
        file,
        error: "Pesquisa sem LIMIT explícito",
      });
    } else {
      for (const [, value] of limits) {
        if (Number(value) > MAX_LIMIT) {
          findings.push({
            file,
            error: `LIMIT maior que ${MAX_LIMIT}`,
          });
        }
      }
    }
  }

  if (!usesKf2Invariants && !content.includes(".order(")) {
    findings.push({
      file,
      error: "Pesquisa sem ORDER BY determinístico",
    });
  }
}

async function run() {
  const files = await fg(SEARCH_FILES);

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    checkFile(file, content);
  }

  if (findings.length > 0) {
    console.error("\n❌ KF2 SEARCH AUDIT FAILED\n");

    for (const finding of findings) {
      console.error(`- ${finding.file}`);
      console.error(`  ↳ ${finding.error}`);
    }

    process.exit(1);
  }

  console.log("✅ KF2 SEARCH AUDIT PASSED");
}

run();
