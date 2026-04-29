import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const forbiddenPattern = "MVP_";
const roots = ["app", "components"];
const ignoredDirs = new Set([".next", ".turbo", "coverage", "node_modules", "out"]);
const ignoredSuffixes = [".tsbuildinfo"];
const maxFileBytes = 2 * 1024 * 1024;

const matches = [];

function shouldSkipFile(pathname) {
  return ignoredSuffixes.some((suffix) => pathname.endsWith(suffix));
}

function scanFile(pathname) {
  if (shouldSkipFile(pathname)) return;

  const stat = statSync(pathname);
  if (stat.size > maxFileBytes) return;

  const content = readFileSync(pathname, "utf8");
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (line.includes(forbiddenPattern)) {
      matches.push(`${relative(process.cwd(), pathname)}:${index + 1}:${line}`);
    }
  });
}

function walk(pathname) {
  const stat = statSync(pathname);
  if (stat.isDirectory()) {
    const name = pathname.split(/[\\/]/).pop();
    if (name && ignoredDirs.has(name)) return;
    for (const entry of readdirSync(pathname)) {
      walk(join(pathname, entry));
    }
    return;
  }

  if (stat.isFile()) {
    scanFile(pathname);
  }
}

try {
  for (const root of roots) {
    const rootPath = join(process.cwd(), root);
    if (existsSync(rootPath)) walk(rootPath);
  }
} catch (error) {
  process.stderr.write("[guard-no-mvp] Falha ao executar verificação.\n");
  process.stderr.write(error instanceof Error ? `${error.message}\n` : `${String(error)}\n`);
  process.exit(2);
}

if (matches.length > 0) {
  process.stderr.write("\n[guard-no-mvp] Encontrado padrão proibido 'MVP_' em telas de gestão.\n");
  process.stderr.write(`${matches.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write("[guard-no-mvp] OK: nenhum padrão 'MVP_' encontrado.\n");
