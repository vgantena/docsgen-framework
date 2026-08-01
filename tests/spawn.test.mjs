/**
 * Unit tests for quoteForCmd (tools/lib/spawn.mjs) — the cmd.exe quoting used
 * by run() on win32. Pure function, so it is asserted on every platform.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {quoteForCmd} from '../tools/lib/spawn.mjs';

test('embedded double quotes are escaped and the arg is wrapped', () => {
  assert.equal(quoteForCmd('[data-testid="a b"]'), '"[data-testid=\\"a b\\"]"');
});

test('args with whitespace are wrapped', () => {
  assert.equal(quoteForCmd('path with space'), '"path with space"');
});

test('args with a percent sign are wrapped (cmd variable expansion)', () => {
  assert.equal(quoteForCmd('100%.png'), '"100%.png"');
});

test('cmd metacharacters are wrapped', () => {
  assert.equal(quoteForCmd('a&b'), '"a&b"');
  assert.equal(quoteForCmd('a|b'), '"a|b"');
  assert.equal(quoteForCmd('(x)'), '"(x)"');
});

test('simple args pass through untouched', () => {
  assert.equal(quoteForCmd('simple'), 'simple');
  assert.equal(quoteForCmd('static/img/items/list.png'), 'static/img/items/list.png');
});
