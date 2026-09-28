export type Finding = {
  file: string;
  error: string;
};

const MAX_LIMIT = 50;
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MIN_MS = 250;
const DEBOUNCE_MAX_MS = 400;

function finding(file: string, error: string): Finding {
  return { file, error };
}

function resolveLimitExpression(
  expression: string,
  hookContent: string,
  seen = new Set<string>(),
): boolean {
  const expr = expression.trim();

  if (/^\d+$/.test(expr)) {
    return Number(expr) <= MAX_LIMIT;
  }

  if (/^Math\.min\(/.test(expr)) {
    const numbers = [...expr.matchAll(/\b(\d+)\b/g)].map((match) => Number(match[1]));
    return numbers.some((value) => value <= MAX_LIMIT);
  }

  if (/^[A-Za-z_$][\w$]*$/.test(expr)) {
    if (seen.has(expr)) return false;
    seen.add(expr);
    const declaration = hookContent.match(
      new RegExp(`(?:const|let)\\s+${expr}\\s*=\\s*([^;]+);`),
    );
    return declaration ? resolveLimitExpression(declaration[1], hookContent, seen) : false;
  }

  return false;
}

function extractRpcLimitExpressions(hookContent: string): string[] {
  return [...hookContent.matchAll(/^\s*p_limit:\s*(.+?),\s*$/gm)].map((match) =>
    match[1].trim(),
  );
}

export function checkGlobalSearchContract(input: {
  hookFile: string;
  hookContent: string;
  sqlFile: string;
  sqlContent: string;
  globalSearchFile: string;
  globalSearchContent: string;
  commandPaletteFile: string;
  commandPaletteContent: string;
}): Finding[] {
  const findings: Finding[] = [];
  const {
    hookFile,
    hookContent,
    sqlFile,
    sqlContent,
    globalSearchFile,
    globalSearchContent,
    commandPaletteFile,
    commandPaletteContent,
  } = input;

  const debounce = hookContent.match(/useDebounce\([^,]+,\s*(\d+)\s*\)/);
  if (!debounce) {
    findings.push(finding(hookFile, "Pesquisa global sem debounce estático verificável"));
  } else {
    const debounceMs = Number(debounce[1]);
    if (debounceMs < DEBOUNCE_MIN_MS || debounceMs > DEBOUNCE_MAX_MS) {
      findings.push(
        finding(
          hookFile,
          `Debounce da pesquisa global fora de ${DEBOUNCE_MIN_MS}-${DEBOUNCE_MAX_MS}ms`,
        ),
      );
    }
  }

  if (!/\.length\s*<\s*2\b/.test(hookContent)) {
    findings.push(
      finding(hookFile, `Pesquisa global sem guarda de mínimo de ${MIN_QUERY_LENGTH} caracteres`),
    );
  }

  const rpcCalls = [...hookContent.matchAll(/\.rpc\(\s*["']search_global_entities["']/g)];
  if (rpcCalls.length === 0) {
    findings.push(finding(hookFile, "Hook não usa RPC canónica search_global_entities"));
  }

  const limitExpressions = extractRpcLimitExpressions(hookContent);
  if (limitExpressions.length !== rpcCalls.length) {
    findings.push(
      finding(
        hookFile,
        "Nem toda chamada a search_global_entities declara p_limit explicitamente",
      ),
    );
  }
  for (const expression of limitExpressions) {
    if (!resolveLimitExpression(expression, hookContent)) {
      findings.push(
        finding(hookFile, `p_limit sem limite superior verificável de ${MAX_LIMIT}: ${expression}`),
      );
    }
  }

  for (const cursorArg of [
    "p_cursor_score",
    "p_cursor_updated_at",
    "p_cursor_created_at",
    "p_cursor_id",
  ]) {
    if (!hookContent.includes(cursorArg)) {
      findings.push(finding(hookFile, `Cursor global incompleto: ${cursorArg} ausente`));
    }
  }

  const normalizedSql = sqlContent.replace(/\s+/g, " ").toLowerCase();
  if (!normalizedSql.includes("search_global_entities")) {
    findings.push(finding(sqlFile, "Migração não define search_global_entities"));
  }

  const clamp = normalizedSql.match(/v_limit\s+int\s*:=\s*least\(.{0,220}?,\s*(\d+)\s*\);/i);
  if (!clamp || Number(clamp[1]) > MAX_LIMIT) {
    findings.push(
      finding(sqlFile, `RPC sem clamp server-side verificável de p_limit <= ${MAX_LIMIT}`),
    );
  }

  if (!normalizedSql.includes("length(v_query) < 2")) {
    findings.push(
      finding(sqlFile, `RPC sem guarda server-side de mínimo de ${MIN_QUERY_LENGTH} caracteres`),
    );
  }

  if (!normalizedSql.includes("has_access_to_escola_fast(p_escola_id)")) {
    findings.push(finding(sqlFile, "RPC sem guarda canónica de acesso à escola"));
  }

  if (!normalizedSql.includes("b.escola_id = p_escola_id")) {
    findings.push(finding(sqlFile, "RPC sem filtro explícito de tenant por escola_id"));
  }

  if (
    !normalizedSql.includes("(score, updated_at, created_at, id)") ||
    !normalizedSql.includes(
      "(p_cursor_score, p_cursor_updated_at, p_cursor_created_at, p_cursor_id)",
    )
  ) {
    findings.push(finding(sqlFile, "RPC sem cursor composto determinístico"));
  }

  if (!normalizedSql.includes("limit v_limit")) {
    findings.push(finding(sqlFile, "RPC não aplica o limite normalizado v_limit"));
  }

  if (!normalizedSql.includes("order by score desc, updated_at desc, created_at desc, id desc")) {
    findings.push(finding(sqlFile, "RPC sem ORDER BY determinístico antes do LIMIT"));
  }

  if (
    !normalizedSql.includes(
      "order by c.score desc, c.updated_at desc, c.created_at desc, c.id desc",
    )
  ) {
    findings.push(finding(sqlFile, "RPC sem ORDER BY determinístico no resultado final"));
  }

  if (!globalSearchContent.includes("useGlobalSearch")) {
    findings.push(finding(globalSearchFile, "GlobalSearch não consome useGlobalSearch"));
  }

  if (!commandPaletteContent.includes("useGlobalSearch")) {
    findings.push(finding(commandPaletteFile, "CommandPalette não consome useGlobalSearch"));
  }

  return findings;
}
