import * as fs from "fs";
import * as path from "path";
import { KnowledgeChunk } from "./knowledge-types";

interface KnowledgeBaseData {
  buildTimestamp: string;
  documentCount: number;
  chunkCount: number;
  chunks: KnowledgeChunk[];
}

let kbCache: KnowledgeBaseData | null = null;

export function loadKnowledgeBase(): KnowledgeBaseData {
  if (kbCache) return kbCache;

  const pathsToTry = [
    path.join(process.cwd(), "apps/web/src/lib/assistant/knowledge-base-data.json"),
    path.join(process.cwd(), "src/lib/assistant/knowledge-base-data.json"),
    path.join(__dirname, "knowledge-base-data.json"),
  ];

  for (const filePath of pathsToTry) {
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, "utf-8");
        kbCache = JSON.parse(data);
        return kbCache!;
      }
    } catch (e) {
      console.error(`Falha ao ler base de conhecimento em ${filePath}:`, e);
    }
  }

  console.warn("Base de dados de conhecimento do KLASSE Brain não encontrada. Retornando vazia.");
  return {
    buildTimestamp: new Date().toISOString(),
    documentCount: 0,
    chunkCount: 0,
    chunks: [],
  };
}

export function searchKnowledge(
  query: string,
  options?: { module?: string; limit?: number }
): KnowledgeChunk[] {
  const kb = loadKnowledgeBase();
  const limit = options?.limit ?? 5;
  const targetModule = options?.module;

  const cleanQuery = query.trim().toLowerCase();

  // If query is empty, return top chunks matching the module or first chunks
  if (!cleanQuery) {
    if (targetModule && targetModule !== "any") {
      return kb.chunks.filter((c) => c.module === targetModule || c.module === "any").slice(0, limit);
    }
    return kb.chunks.slice(0, limit);
  }

  // Normalize query tokens to match content without accents
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const queryNormalized = normalize(cleanQuery);
  const queryTokens = queryNormalized
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((t) => t.length > 2); // Exclude very short words

  if (queryTokens.length === 0) {
    // If query is short, keep original tokenized terms
    queryTokens.push(...queryNormalized.split(/\s+/));
  }

  const scored = kb.chunks.map((chunk) => {
    let score = 0;
    const contentNorm = normalize(chunk.content);
    const titleNorm = normalize(chunk.metadata?.title || "");
    const sectionNorm = normalize(chunk.metadata?.section || "");

    // Module Match Boost
    if (targetModule && targetModule !== "any") {
      if (chunk.module === targetModule) {
        score += 5; // Direct match
      } else if (chunk.module === "any") {
        score += 1; // Generic match
      }
    }

    // Term Matching
    for (const token of queryTokens) {
      // Direct string matching
      if (contentNorm.includes(token)) {
        score += 2;
        // Exact word boundary matching
        if (new RegExp(`\\b${token}\\b`, "i").test(contentNorm)) {
          score += 3;
        }
      }
      if (titleNorm.includes(token)) {
        score += 10; // High weight for title matches
      }
      if (sectionNorm.includes(token)) {
        score += 6; // Medium weight for section matches
      }
    }

    return { chunk, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.chunk);
}
