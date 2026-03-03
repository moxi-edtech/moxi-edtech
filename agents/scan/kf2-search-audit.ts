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
const findingKeys = new Set<string>();

function pushFinding(file: string, error: string) {
  const key = `${file}::${error}`;
  if (findingKeys.has(key)) return;
  findingKeys.add(key);
  findings.push({ file, error });
}

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

function hasExplicitLimit(segment: string) {
  return /\.limit\(\s*[^)]+\)/.test(segment);
}

function extractNumericLimits(segment: string) {
  const matches = [...segment.matchAll(/\.limit\(\s*(\d+)\s*\)/g)];
  return matches.map(([, value]) => Number(value));
}

function hasRange(segment: string) {
  return /\.range\(\s*[^,]+\s*,\s*[^)]+\)/.test(segment);
}

function hasDeterministicOrder(segment: string) {
  const orders = [...segment.matchAll(/\.order\(\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]);
  if (orders.length === 0) return false;

  if (orders.some((field) => field === "id" || field === "created_at" || field === "updated_at")) {
    return true;
  }

  return false;
}


function isReadQuerySegment(segment: string) {
  if (segment.startsWith('.rpc(')) {
    return true;
  }

  return segment.includes('.select(');
}

function isWriteQuerySegment(segment: string) {
  return (
    segment.includes(".insert(") ||
    segment.includes(".update(") ||
    segment.includes(".upsert(") ||
    segment.includes(".delete(")
  );
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

  const querySegments = extractQuerySegments(content);
  if (querySegments.length === 0) {
    return;
  }

  for (const segment of querySegments) {
    if (!isReadQuerySegment(segment) || isWriteQuerySegment(segment)) {
      continue;
    }

    if (segment.includes(".select('*')") || segment.includes('.select("*")')) {
      pushFinding(file, "Uso de select('*') em pesquisa");
    }

    const limits = extractNumericLimits(segment);
    const usesKf2Invariants = hasKf2Invariants(content);
    const singleRowQuery = isSingleRowQuery(segment);
    const aggregateQuery =
      segment.includes("count(") ||
      segment.includes("COUNT(") ||
      segment.includes("sum(") ||
      segment.includes("SUM(") ||
      segment.includes("group(");

    if (!usesKf2Invariants && !singleRowQuery && !segment.startsWith(".rpc(")) {
      if (!hasExplicitLimit(segment) && !hasRange(segment)) {
        pushFinding(file, "Pesquisa sem LIMIT explícito");
      } else {
        for (const value of limits) {
          if (value > MAX_LIMIT) {
            pushFinding(file, `LIMIT maior que ${MAX_LIMIT}`);
          }
        }

        const rangeMatch = segment.match(/\.range\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
        if (rangeMatch) {
          const from = Number(rangeMatch[1]);
          const to = Number(rangeMatch[2]);
          if (to - from + 1 > MAX_LIMIT) {
            pushFinding(file, `LIMIT maior que ${MAX_LIMIT}`);
          }
        }
      }
    }

    if (
      !usesKf2Invariants &&
      !singleRowQuery &&
      !aggregateQuery &&
      !segment.startsWith(".rpc(") &&
      !hasDeterministicOrder(segment)
    ) {
      pushFinding(file, "Pesquisa sem ORDER BY determinístico");
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
