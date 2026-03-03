import fg from "fast-glob";
import fs from "fs";

const SEARCH_FILES = [
  "apps/web/src/app/api/**/search*/**/*.ts",
  "apps/web/src/app/api/**/route.ts",
  "apps/web/src/lib/**/search*.ts",
];

const MAX_LIMIT = 50;

const KF2_SCAN_PATH_EXCLUDES = [
  "/pdf/",
  "/declaracao/",
  "/comprovante-matricula/",
  "/historico/snapshot/",
  "/fechamento-academico/",
  "/documentos-oficiais/lote/",
];

type Finding = {
  file: string;
  error: string;
};

const findings: Finding[] = [];

const QUERY_END_MARKER = /(?:;|\n\s*return\s+|\n\s*const\s+|\n\s*let\s+|\n\s*if\s*\(|\n\s*}\s*catch)/;

function hasAllowScan(content: string) {
  return content.includes("@kf2 allow-scan");
}

function hasKf2Invariants(content: string) {
  return content.includes("applyKf2ListInvariants");
}

function extractQuerySegments(content: string) {
  const segments: string[] = [];
  const queryRegex = /\.(from|rpc)\(/g;

  for (const match of content.matchAll(queryRegex)) {
    const start = match.index ?? -1;
    if (start < 0) continue;

    const rest = content.slice(start);
    const endMatch = rest.match(QUERY_END_MARKER);
    const end = endMatch?.index ?? rest.length;

    segments.push(rest.slice(0, end));
  }

  return segments;
}

function isSingleRowQuery(segment: string) {
  return (
    segment.includes(".single(") ||
    segment.includes(".maybeSingle(") ||
    segment.includes("head: true") ||
    /\.limit\(\s*1\s*\)/.test(segment)
  );
}

function hasRange(segment: string) {
  return /\.range\(\s*\d+\s*,\s*\d+\s*\)/.test(segment);
}

function hasDeterministicOrder(segment: string) {
  return segment.includes(".order(");
}

function checkFile(file: string, content: string) {
  if (hasAllowScan(content)) {
    return;
  }

  if (KF2_SCAN_PATH_EXCLUDES.some((pathPart) => file.includes(pathPart))) {
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

  const querySegments = extractQuerySegments(content);
  if (querySegments.length === 0) {
    return;
  }

  for (const segment of querySegments) {
    if (segment.includes(".select('*')") || segment.includes('.select("*")')) {
      findings.push({
        file,
        error: "Uso de select('*') em pesquisa",
      });
    }

    const limitRegex = /\.limit\((\d+)\)/g;
    const limits = [...segment.matchAll(limitRegex)];
    const usesKf2Invariants = hasKf2Invariants(content);
    const singleRowQuery = isSingleRowQuery(segment);
    const aggregateQuery =
      segment.includes("count(") ||
      segment.includes("COUNT(") ||
      segment.includes("sum(") ||
      segment.includes("SUM(") ||
      segment.includes("group(");

    if (!usesKf2Invariants && !singleRowQuery) {
      if (limits.length === 0 && !hasRange(segment)) {
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

        const rangeMatch = segment.match(/\.range\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
        if (rangeMatch) {
          const from = Number(rangeMatch[1]);
          const to = Number(rangeMatch[2]);
          if (to - from + 1 > MAX_LIMIT) {
            findings.push({
              file,
              error: `LIMIT maior que ${MAX_LIMIT}`,
            });
          }
        }
      }
    }

    if (
      !usesKf2Invariants &&
      !singleRowQuery &&
      !aggregateQuery &&
      !hasDeterministicOrder(segment)
    ) {
      findings.push({
        file,
        error: "Pesquisa sem ORDER BY determinístico",
      });
    }
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
