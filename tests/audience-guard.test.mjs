/**
 * Guard: pages marked `audience: internal` must also set `draft: true`.
 * Docusaurus excludes drafts from production builds, so this is what keeps
 * internal-only content OFF the public site while the KB export (which reads
 * files directly, not the build) still picks it up with internal visibility.
 */
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(p));
    else if (/\.(md|mdx)$/i.test(entry.name)) files.push(p);
  }
  return files;
}

function frontmatterOf(source) {
  const clean = source.replace(/^\uFEFF/, '');
  const m = clean.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : '';
}

test('audience: internal pages are drafts (excluded from the public build)', () => {
  const offenders = [];
  for (const file of walk('docs')) {
    const fm = frontmatterOf(readFileSync(file, 'utf8'));
    const internal = /^audience:\s*internal\s*(#.*)?$/m.test(fm);
    const draft = /^draft:\s*true\s*(#.*)?$/m.test(fm);
    if (internal && !draft) offenders.push(file);
  }
  assert.deepEqual(
    offenders,
    [],
    `internal pages must set "draft: true" so they never ship on the public site:\n  ${offenders.join('\n  ')}`,
  );
});
