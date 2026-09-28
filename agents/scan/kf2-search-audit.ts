import fg from "fast-glob";
import fs from "fs";

import { checkFile, type Finding } from "./kf2-search-audit-core";

const SEARCH_FILES = [
  "apps/web/src/app/api/**/search*/**/*.ts",
  "apps/web/src/app/api/**/route.ts",
  "apps/web/src/lib/**/search*.ts",
];

async function run() {
  const files = await fg(SEARCH_FILES);
  const findings: Finding[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    findings.push(...checkFile(file, content));
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
