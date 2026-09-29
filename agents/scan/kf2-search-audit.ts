import fg from "fast-glob";
import fs from "fs";

import { checkGlobalSearchContract, type Finding } from "./kf2-search-audit-core";

const HOOK_FILE = "apps/web/src/hooks/useGlobalSearch.ts";
const GLOBAL_SEARCH_FILE = "apps/web/src/components/GlobalSearch.tsx";
const COMMAND_PALETTE_FILE = "apps/web/src/components/CommandPalette.tsx";
const MIGRATION_GLOB = "supabase/migrations/*.sql";
const SEARCH_GLOBAL_FUNCTION =
  /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:"?public"?\.)?"?search_global_entities"?\s*\(/i;

function readRequired(file: string): string {
  if (!fs.existsSync(file)) {
    throw new Error(`KF2 contract file not found: ${file}`);
  }
  return fs.readFileSync(file, "utf8");
}

function resolveLatestGlobalSearchMigration(): { file: string; content: string } {
  const candidates = fg
    .sync(MIGRATION_GLOB)
    .sort()
    .map((file) => ({ file, content: fs.readFileSync(file, "utf8") }))
    .filter(({ content }) => SEARCH_GLOBAL_FUNCTION.test(content));

  const latest = candidates.at(-1);
  if (!latest) {
    throw new Error("No migration defines public.search_global_entities");
  }
  return latest;
}

async function run() {
  const findings: Finding[] = [];

  try {
    const migration = resolveLatestGlobalSearchMigration();
    findings.push(
      ...checkGlobalSearchContract({
        hookFile: HOOK_FILE,
        hookContent: readRequired(HOOK_FILE),
        sqlFile: migration.file,
        sqlContent: migration.content,
        globalSearchFile: GLOBAL_SEARCH_FILE,
        globalSearchContent: readRequired(GLOBAL_SEARCH_FILE),
        commandPaletteFile: COMMAND_PALETTE_FILE,
        commandPaletteContent: readRequired(COMMAND_PALETTE_FILE),
      }),
    );
  } catch (error) {
    findings.push({
      file: "KF2 contract",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (findings.length > 0) {
    console.error("\n❌ KF2 SEARCH AUDIT FAILED\n");
    for (const item of findings) {
      console.error(`- ${item.file}`);
      console.error(`  ↳ ${item.error}`);
    }
    process.exit(1);
  }

  console.log("✅ KF2 SEARCH AUDIT PASSED — Global Search contract validated");
}

run();
