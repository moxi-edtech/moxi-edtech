#!/usr/bin/env node
// Repository-only guard. It does not access a Supabase project or apply SQL.
// Reject migration filenames the CLI cannot version unambiguously.
import { readdirSync, readFileSync } from 'node:fs';
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

// AUT-003: a migração da PR #320 nunca deve preceder o último
// identificador remoto documentado. Isto é um preflight ESTÁTICO;
// o gate de deploy continua a exigir uma comparação remota atualizada.
const auditSnapshot = resolve(process.cwd(),
  'supabase/ops/reports/aut003_transfer_migration_ledger_snapshot_20261104.json');
try {
  const snapshot = JSON.parse(readFileSync(auditSnapshot, 'utf8'));
  const candidate = snapshot.transfer_migration?.file;
  const version = snapshot.transfer_migration?.version;
  const remoteLatest = snapshot.remote_latest_version;
  if (!candidate || !version || !remoteLatest
      || candidate.slice(0, 14) !== version
      || versions.get(version) !== candidate) {
    errors.push('AUT-003: forward-only transfer migration missing or version mismatch');
  } else if (version <= remoteLatest) {
    errors.push('AUT-003: transfer migration would replay before the last remote version');
  }
  if (snapshot.counts?.local_not_in_remote > 1
      || snapshot.counts?.remote_not_in_local > 0) {
    console.warn('::warning::AUT-003: historic migration ledger remains divergent; '
      + 'CI naming guard is NOT deployment approval. Do not run db push.');
  }
} catch (cause) {
  errors.push('AUT-003: missing/invalid migration ledger baseline: ' + cause.message);
}

if (errors.length) {
  for (const error of errors) console.error(`::error::${error}`);
  console.error(`FAIL: ${errors.length} migration naming issue(s); do not run db push.`);
  process.exitCode = 1;
} else {
  console.log(`PASS: ${sqlCount} SQL files, ${versions.size} unique versioned migrations, zero rollback files.`);
}
