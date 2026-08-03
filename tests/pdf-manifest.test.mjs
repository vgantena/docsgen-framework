/**
 * Guard: tools/pdf-manifest.json drives `npm run pdf`, and nothing else reads
 * it — so it rots silently. A chapter that was renamed or deleted only shows up
 * as a confusing pandoc error, and a manifest still listing only the framework
 * sample produces a manual about a product that does not exist.
 */
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';

const manifest = JSON.parse(readFileSync(resolve('tools/pdf-manifest.json'), 'utf8'));
const chapters = manifest.chapters ?? [];

test('every PDF chapter exists on disk', () => {
  const missing = chapters.filter((chapter) => !existsSync(resolve(chapter)));
  assert.deepEqual(
    missing,
    [],
    `tools/pdf-manifest.json lists pages that are gone — update it in the same commit that moves or deletes a page:\n  ${missing.join('\n  ')}`,
  );
});

test('the PDF manifest has an output path and at least one chapter', () => {
  assert.match(manifest.output ?? '', /\.pdf$/, 'output must be a .pdf path');
  assert.ok(chapters.length > 0, 'a manual with no chapters is a broken build, not an empty book');
});

test('no chapter is listed twice', () => {
  const seen = new Set();
  const duplicates = chapters.filter((chapter) => {
    if (seen.has(chapter)) return true;
    seen.add(chapter);
    return false;
  });
  assert.deepEqual(duplicates, [], `duplicate chapters render twice in the manual: ${duplicates.join(', ')}`);
});
