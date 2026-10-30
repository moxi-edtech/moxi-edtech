#!/usr/bin/env node
// Repository-only guard. It does not access a Supabase project or apply SQL.
// Reject migration filenames the CLI cannot version unambiguously.
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const directory = resolve(process.cwd(), 'supabase/migrations');
const entries = readdirSync(directory, { withFileTypes: true });
const versions = new Map();
const errors = [];
let sqlCount = 0;

for (const entry of entries) {
  if (!entry.name.endsWith('.sql')) continue;
  sqlCount++;
  if (!entry.isFile()) {
    errors.push(`SQL entry is not a regular file: ${entry.name}`);
    continue;
  }

  const match = /^(\d{14})_[a-zA-Z0-9][a-zA-Z0-9_.-]*\.sql$/.exec(entry.name);
  if (!match) {
    errors.push(`Unversioned or invalid migration filename: ${entry.name}`);
    continue;
  }

  if (/\.(rollback|down|revert)\.sql$/i.test(entry.name)) {
    errors.push(`Rollback belongs under supabase/ops/, not migrations/: ${entry.name}`);
  }

  const version = match[1];
  const earlier = versions.get(version);
  if (earlier) {
    errors.push(`Duplicate migration version ${version}: ${earlier} and ${entry.name}`);
  } else {
    versions.set(version, entry.name);
  }
}

if (errors.length) {
  for (const error of errors) console.error(`::error::${error}`);
  console.error(`FAIL: ${errors.length} migration naming issue(s); do not run db push.`);
  process.exitCode = 1;
} else {
  console.log(`PASS: ${sqlCount} SQL files, ${versions.size} unique versioned migrations, zero rollback files.`);
}
