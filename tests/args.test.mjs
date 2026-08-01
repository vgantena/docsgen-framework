/**
 * Unit tests for the shared CLI parser (tools/lib/args.mjs) — the edge cases
 * every tool used to hand-roll (and get subtly wrong) are pinned down here.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseArgs, str, num} from '../tools/lib/args.mjs';

test('--key value and --key=value both parse', () => {
  const {args} = parseArgs(['--manifest', 'tools/media/items.json', '--base=http://localhost:3000']);
  assert.equal(args.manifest, 'tools/media/items.json');
  assert.equal(args.base, 'http://localhost:3000');
});

test('a token starting with -- is never swallowed as a value', () => {
  const {args} = parseArgs(['--tagline', '--fresh']);
  assert.equal(args.tagline, true, 'tagline stays flag-only');
  assert.equal(args.fresh, true, '--fresh is still parsed as its own flag');
});

test('repeated multi flags collect every occurrence in order', () => {
  const {lists} = parseArgs(['--click', '#a', '--click', '#b', '--click=#c'], {multi: ['click']});
  assert.deepEqual(lists.click, ['#a', '#b', '#c']);
});

test('str() returns undefined for a flag-only value', () => {
  const {args} = parseArgs(['--only', '--filter', 'x']);
  assert.equal(args.only, true);
  assert.equal(str(args, 'only'), undefined);
  assert.equal(str(args, 'filter'), 'x');
});

test('num() falls back when absent and parses valid numbers', () => {
  const {args} = parseArgs(['--wait', '250']);
  assert.equal(num(args, 'wait', 100), 250);
  assert.equal(num(args, 'width', 1280), 1280);
});

test('num() exits 1 on a non-numeric value', () => {
  const url = pathToFileURL(resolve('tools/lib/args.mjs')).href;
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `import {num} from '${url}'; num({width: 'abc'}, 'width', 1280); console.log('unreachable');`],
    {encoding: 'utf8'},
  );
  assert.equal(result.status, 1, `expected exit 1, got ${result.status}: ${result.stderr}`);
  assert.match(result.stderr, /--width needs a numeric value/);
  assert.ok(!result.stdout.includes('unreachable'), 'num() must exit, not return');
});
