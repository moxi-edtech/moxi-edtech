/** Presentation-only limits. Never alter verified counts, provenance or academic scope. */
export const CHAT_SUMMARY_WORD_TARGET = 65;
export const CHAT_RESPONSE_TOKEN_CEILING = 384;
export const CHAT_MESSAGE_LIMIT = 2000;

export type ChatTable = { headers: string[]; rows: string[][] };
export type ChatPresentation = { summary: string; details: string; tables: ChatTable[] };

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

/** Markdown table extraction: treat returned text as plain text, never as HTML. */
export function extractChatTables(content: string): { text: string; tables: ChatTable[] } {
  const lines = content.replace(/\r/g, "").split("\n");
  const tables: ChatTable[] = [];
  const output: string[] = [];
  for (let i = 0; i < lines.length;) {
    const header = lines[i].trim();
    const separator = lines[i + 1]?.trim() ?? "";
    const isTable = header.startsWith("|") && /^\|?[\s:|-]+\|?$/.test(separator) && separator.includes("-");
    if (!isTable) { output.push(lines[i]); i++; continue; }
    const cells = (line: string) => line.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
    const headings = cells(header);
    if (headings.length < 2 || cells(separator).length !== headings.length) {
      output.push(lines[i]); i++; continue;
    }
    const rows: string[][] = [];
    i += 2;
    while (i < lines.length && lines[i].trim().startsWith("|")) {
      const row = cells(lines[i]);
      if (row.length !== headings.length) break;
      rows.push(row); i++;
    }
    if (rows.length) tables.push({ headers: headings, rows });
    else output.push(header, separator);
  }
  return { text: output.join("\n").trim(), tables };
}

function stripHeading(value: string) {
  return value.replace(/^\s*(?:#{1,4}\s+|\*\*(?:Diagnóstico|Resposta|Resultado)\*\*\s*)/i, "")
    .replace(/\*\*/g, "").trim();
}

/** Never truncate inside a number, table, sentence or bullet item. Move full units to details. */
export function presentChatResponse(content: string): ChatPresentation {
  const { text, tables } = extractChatTables(content);
  const chunks = text.split(/\n\s*\n/).map(stripHeading).filter(Boolean);
  const first = chunks[0] ?? "";
  if (!first) return { summary: tables.length ? "Consulte os resultados na tabela." : "", details: "", tables };
  // Prefer sentence boundaries, but keep numeric/abbreviation decimal punctuation intact.
  const sentences = first.split(/(?<=[.!?])\s+(?=[\p{Lu}])/u);
  let summary = "";
  let consumed = 0;
  for (const sentence of sentences) {
    if (summary && countWords(`${summary} ${sentence}`) > CHAT_SUMMARY_WORD_TARGET) break;
    summary += `${summary ? " " : ""}${sentence}`;
    consumed++;
    if (consumed === 2) break;
  }
  // A single long, inseparable sentence must remain intact for numerical safety.
  const remainder = sentences.slice(consumed).join(" ");
  const details = [remainder, ...chunks.slice(1)].filter(Boolean).join("\n\n");
  return { summary, details, tables };
}

export function canSubmitChatKey(event: { key: string; shiftKey: boolean; isComposing: boolean; keyCode?: number }, isMobile: boolean) {
  return event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229 && !isMobile;
}

export function chatContextKey(userId: string, schoolId: string, yearId: string | null, poloId: string | null) {
  return `${userId}:${schoolId}:${yearId ?? "ano-atual"}:${poloId ?? "sem-polo"}`;
}
