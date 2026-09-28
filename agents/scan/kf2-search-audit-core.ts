const MAX_LIMIT = 50;

const KF2_SCAN_PATH_EXCLUDES = [
  "/pdf/",
  "/declaracao/",
  "/comprovante-matricula/",
  "/historico/snapshot/",
  "/fechamento-academico/",
  "/documentos-oficiais/lote/",
];

export type Finding = {
  file: string;
  error: string;
};

const QUERY_END_MARKER = /(?:;|\n\s*return\s+|\n\s*const\s+|\n\s*let\s+|\n\s*if\s*\(|\n\s*}\s*catch)/;

function hasAllowScan(content: string) {
  return content.includes("@kf2 allow-scan");
}

function hasKf2Invariants(content: string) {
  return content.includes("applyKf2ListInvariants");
}

export function extractQuerySegments(content: string) {
  const segments: string[] = [];
  const queryRegex = /\.(from|rpc)\(/g;

  for (const match of content.matchAll(queryRegex)) {
    const start = match.index ?? -1;
    if (start < 0) continue;

    const rest = content.slice(start);
    const endMatch = rest.match(QUERY_END_MARKER);
    const end = endMatch?.index ?? rest.length;
    const segment = rest.slice(0, end);

    // `.from(...)` is overloaded in JS/TS (Buffer.from, Array.from, etc.).
    // KF2 audits Supabase reads, so a `from` segment only qualifies when it
    // contains the PostgREST `.select(...)` read operation. RPC calls remain
    // auditable because they can return list/search results without `.select()`.
    if (match[1] === "from" && !segment.includes(".select(")) {
      continue;
    }

    segments.push(segment);
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

export function checkFile(file: string, content: string): Finding[] {
  const findings: Finding[] = [];

  if (hasAllowScan(content)) {
    return findings;
  }

  if (KF2_SCAN_PATH_EXCLUDES.some((pathPart) => file.includes(pathPart))) {
    return findings;
  }

  if (file.includes("/app/api/") || file.includes("\\app\\api\\")) {
    const hasGetHandler =
      content.includes("export async function GET") ||
      content.includes("export function GET") ||
      content.includes("export const GET");
    if (!hasGetHandler) {
      return findings;
    }
  }

  const querySegments = extractQuerySegments(content);
  if (querySegments.length === 0) {
    return findings;
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

  return findings;
}
