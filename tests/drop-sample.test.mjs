/**
 * Guard: `drop-sample --dry-run` must name every file that still points at the
 * sample — including config, not just prose.
 *
 * It once scanned docs/ and site.config.ts only. sidebars.ts also references
 * the sample, by doc id and directory rather than by route, so the scan missed
 * it entirely: graduating deleted the pages and left the repo unable to build
 * ("Invalid sidebar file"), with the tool reporting nothing about the file
 * responsible. A sidebar entry for a deleted doc is a hard failure, not a
 * broken link, so it has to be reported BEFORE the deletion.
 */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';

const run = () =>
  spawnSync(process.execPath, ['tools/drop-sample.mjs', '--dry-run'], {encoding: 'utf8'});

/** Sample paths the tool reports it would delete, read back from its own output. */
function wouldRemove(stdout) {
  return stdout
    .split(/\r?\n/)
    .filter((l) => l.startsWith('would remove '))
    .map((l) => l.replace('would remove ', '').trim());
}

test('dry run leaves the tree alone and exits clean', () => {
  const before = existsSync(resolve('docs/developers/projects-api'));
  const result = run();
  assert.equal(result.status, 0, `drop-sample exited ${result.status}: ${result.stderr}`);
  assert.equal(
    existsSync(resolve('docs/developers/projects-api')),
    before,
    'a dry run must not delete anything',
  );
});

test('every config file that references the sample is reported', () => {
  const {stdout} = run();
  const removing = wouldRemove(stdout);
  assert.ok(removing.length > 0, 'expected the sample to still be present to test against');

  // Directory-shaped sample paths, as a sidebar or navbar would name them:
  // "docs/developers/files-api" → "developers/files-api".
  const refs = removing
    .filter((p) => !p.endsWith('.md') && !p.endsWith('.mdx'))
    .map((p) => p.replace(/^docs\//, ''));

  for (const file of ['sidebars.ts', 'site.config.ts']) {
    if (!existsSync(resolve(file))) continue;
    const source = readFileSync(resolve(file), 'utf8');
    const referenced = refs.some((ref) => source.includes(ref));
    if (!referenced) continue;
    // Match the reported "file:line" form, not the bare filename: the report
    // also prints an explanatory hint naming sidebars.ts, and asserting on the
    // filename alone passed even with the sidebars scan removed.
    assert.match(
      stdout,
      new RegExp(`${file.replace('.', '\\.')}:\\d+`),
      `${file} references the sample but drop-sample never reports a line from it — graduating would break the build with no warning`,
    );
  }
});
