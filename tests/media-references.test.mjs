/**
 * Guard: every image and video a docs page RENDERS must exist in static/.
 *
 * `onBrokenLinks: throw` checks links, not media — so a Figure, Video, or
 * Carousel pointing at a deleted screenshot builds clean and ships a broken
 * image. That is exactly how the component showcase came to render a Carousel
 * with two 404s: it was authored against sample media the repo never had.
 *
 * Fenced blocks and inline code spans are documentation ABOUT the components
 * (they show the syntax), not uses of them, so they are excluded. Both quoting
 * styles are checked: `src="/img/a.png"` on a JSX attribute and `src: '/img/a.png'`
 * inside a Carousel's slides array — missing the second is why this went
 * unnoticed.
 */
import assert from 'node:assert/strict';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import test from 'node:test';

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (/\.mdx?$/i.test(path)) out.push(path);
  }
  return out;
}

/** Media paths a page actually renders, as [{ref, file, line}]. */
function renderedMediaRefs(file) {
  const refs = [];
  let inFence = false;
  let n = 0;
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    n++;
    if (/^\s*```/.test(raw)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const line = raw.replace(/`[^`]*`/g, ''); // inline code is prose, not a render
    const patterns = [
      /(?:src|poster|captions)="(\/(?:img|video)\/[^"]+)"/g, // JSX attribute
      /(?:src|poster|captions):\s*'(\/(?:img|video)\/[^']+)'/g, // object literal (Carousel slides)
      /(?:src|poster|captions):\s*"(\/(?:img|video)\/[^"]+)"/g,
    ];
    for (const re of patterns) {
      for (const m of line.matchAll(re)) {
        refs.push({ref: m[1], file: file.split(/[\\/]/).join('/'), line: n});
      }
    }
  }
  return refs;
}

test('every rendered image and video reference exists in static/', () => {
  const all = walk('docs').flatMap(renderedMediaRefs);
  assert.ok(all.length > 0, 'expected the docs to render at least one image or video');

  const missing = all
    .filter(({ref}) => !existsSync(resolve('static' + ref)))
    .map(({ref, file, line}) => `${file}:${line} → ${ref}`);

  assert.deepEqual(
    missing,
    [],
    `docs render media with no file behind it — commit the asset, or point the page at one that exists:\n  ${missing.join('\n  ')}`,
  );
});
