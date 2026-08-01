/**
 * CLI-level tests for tools/init-product.mjs. Everything runs with --dry-run
 * (which never writes), so the real site.config.ts is never touched.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

function runInit(extraArgs) {
  return spawnSync(process.execPath, ['tools/init-product.mjs', ...extraArgs], {encoding: 'utf8'});
}

test('dry-run with apostrophes and $& in values succeeds and prints them literally', () => {
  const name = "O'Brien $& Co";
  const tagline = "It's 100% $1 $& great";
  const result = runInit([
    '--dry-run',
    '--name', name,
    '--org', "Acme's Holdings",
    '--org-url', 'https://example.com',
    '--app-url', 'http://app.localhost',
    '--docs-url', 'https://docs.example.com',
    '--tagline', tagline,
  ]);
  assert.equal(result.status, 0, `exited ${result.status}: ${result.stderr}`);
  // The "would set" lines echo the literal value — proves the escaping and
  // replacement-function paths ran without expanding $&/$1 or breaking quotes.
  assert.ok(result.stdout.includes(`→ "${name}"`), `product.name value missing from:\n${result.stdout}`);
  assert.ok(result.stdout.includes(`→ "${tagline}"`), `tagline value missing from:\n${result.stdout}`);
  assert.ok(result.stdout.includes(`→ "Acme's Holdings"`), `org.name value missing from:\n${result.stdout}`);
  assert.match(result.stdout, /Dry run — nothing was changed/);
});

test('a required flag whose value was swallowed is reported as missing', () => {
  // --name consumes no value (next token is a flag), so it must land in the
  // missing list rather than silently becoming `true`.
  const result = runInit([
    '--dry-run',
    '--name',
    '--org', 'X',
    '--org-url', 'https://example.com',
    '--app-url', 'http://app.localhost',
    '--docs-url', 'https://docs.example.com',
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing: .*--name/);
});

test('omitted required flags are all listed', () => {
  const result = runInit(['--dry-run', '--name', 'X']);
  assert.equal(result.status, 1);
  for (const flag of ['--org', '--org-url', '--app-url', '--docs-url']) {
    assert.ok(result.stderr.includes(flag), `${flag} missing from: ${result.stderr}`);
  }
});
