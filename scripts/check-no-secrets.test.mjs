import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const path = '.github/workflows/balcao-academic-operations.yml';
const workflow = readFileSync(join(root, path), 'utf8');
const urls = workflow.split('\n').filter((line) => line.trim().startsWith('PGURL:'));
assert.equal(urls.length, 2);
const line = urls[0];
const cases = [
  ['academic disposable service', path, line, true],
  ['actions disposable service', path, urls[1], true],
  ['different password', path, line.replace('postgres:postgres@', 'postgres:synthetic@'), false],
  ['different user', path, line.replace('postgres:postgres@', 'another:postgres@'), false],
  ['different host', path, line.replace('127.0.0.1', 'database.invalid'), false],
  ['different port', path, line.replace(':5432/', ':5433/'), false],
  ['different database', path, line.replace('balcao_academic_test', 'customer_database'), false],
  ['different file', 'docs/example.yml', line, false],
  ['extra credential on line', path, line + ' ' + 'ghp_' + 'x'.repeat(36), false],
  ['credential on following line', path, line + '\n' + 'ghp_' + 'x'.repeat(36), false],
  ['extra suffix', path, line + '?sslmode=require', false],
];
for (const [name, file, content, allowed] of cases) {
  test(name, () => {
    const dir = mkdtempSync(join(tmpdir(), 'klasse-secret-fixture-'));
    try {
      mkdirSync(join(dir, 'scripts'));
      copyFileSync(join(root, 'scripts/check-no-secrets.sh'), join(dir, 'scripts/check-no-secrets.sh'));
      const target = join(dir, file); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, content + '\n');
      const git = (args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' }).toString().trim();
      git(['init', '-q']);
      // Only a throwaway fixture repo: no user hooks/credentials or network.
      git(['config', 'core.hooksPath', join(dir, 'empty-test-hooks')]);
      git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-qm', 'empty fixture base']);
      git(['add', file]);
      git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'synthetic scanner fixture']);
      const sha = git(['rev-parse', 'HEAD']);
      const result = spawnSync('bash', [join(dir, 'scripts/check-no-secrets.sh')], { cwd: dir, encoding: 'utf8', input: `refs/heads/fixture ${sha} refs/heads/fixture ${'0'.repeat(40)}\n` });
      assert.equal(result.status, allowed ? 0 : 1, name);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}
