/**
 * CLI-level tests for the KB export planner (tools/docgen-kb-export.mjs) —
 * mirrors the docgen-plan test approach: run the tool against a fixture docs
 * tree in a temp dir and assert on the written plan.
 */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';

const TOOL = 'tools/docgen-kb-export.mjs';

function makeFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'kb-export-'));
  const docs = join(dir, 'docs');
  mkdirSync(join(docs, 'guides', 'items'), {recursive: true});
  writeFileSync(
    join(docs, 'guides', 'items', 'adjust-stock.md'),
    [
      '---',
      'title: Adjust stock',
      'description: Change on-hand quantity.',
      'category: Projects',
      'keywords: [stock, adjustment, opening stock]',
      'audience: vendor',
      '---',
      '',
      '# Adjust stock',
      '',
      'Intro paragraph.',
      '',
      '<Steps>',
      '',
      '1. Open the row menu.',
      '',
      '</Steps>',
      '',
    ].join('\n'),
  );
  writeFileSync(
    join(docs, 'guides', 'items', 'no-category.md'),
    ['---', 'title: Framework page', '---', '', '# Framework page', ''].join('\n'),
  );
  writeFileSync(
    join(docs, 'guides', 'items', 'bad-category.md'),
    [
      '---',
      'title: Bad category',
      'category: Not A Component',
      'keywords: [x]',
      'audience: vendor',
      '---',
      '',
      '# Bad category',
      '',
    ].join('\n'),
  );
  return {dir, docs};
}

function runTool(dir, docs) {
  const manifest = join(dir, 'kb-manifest.json');
  const out = join(dir, 'kb-plan.json');
  const result = spawnSync(
    process.execPath,
    [TOOL, '--docs', docs, '--manifest', manifest, '--out', out],
    {encoding: 'utf8'},
  );
  return {result, manifest, out};
}

test('plans ADD for KB-mapped pages, skips unmapped, warns on bad category', () => {
  const {dir, docs} = makeFixture();
  try {
    const {result, out} = runTool(dir, docs);
    assert.equal(result.status, 0, result.stderr);
    const plan = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(plan.plan.add.length, 1);
    const article = plan.plan.add[0];
    assert.equal(article.slug, 'guides-items-adjust-stock');
    assert.equal(article.category, 'Projects');
    assert.equal(article.visibility, 'vendor');
    assert.equal(article.status, 'published');
    assert.equal(article.tags, 'stock, adjustment, opening stock');
    assert.ok(!article.body.startsWith('# Adjust stock'), 'leading H1 is stripped');
    assert.ok(article.body.includes('1. Open the row menu.'), 'Steps unwrapped to a list');
    assert.ok(!article.body.includes('<Steps>'), 'no JSX remains');
    assert.ok(plan.warnings.some((w) => w.includes('bad-category')), 'bad category warned');
    assert.ok(!JSON.stringify(plan.plan).includes('no-category'), 'unmapped page excluded');
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

test('unchanged pages plan as SKIP once the manifest holds their hash', () => {
  const {dir, docs} = makeFixture();
  try {
    const first = runTool(dir, docs);
    const plan1 = JSON.parse(readFileSync(first.out, 'utf8'));
    const article = plan1.plan.add[0];
    writeFileSync(
      first.manifest,
      JSON.stringify({pages: {[article.slug]: {sourcePath: article.sourcePath, hash: article.hash}}}),
    );
    const second = runTool(dir, docs);
    const plan2 = JSON.parse(readFileSync(second.out, 'utf8'));
    assert.equal(plan2.plan.add.length, 0);
    assert.equal(plan2.plan.update.length, 0);
    assert.equal(plan2.plan.skip.length, 1);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

test('two pages normalizing to the same slug abort with both paths named', () => {
  const {dir, docs} = makeFixture();
  try {
    // guides/items/adjust-stock.md already exists; guides/items-adjust-stock.md
    // normalizes to the identical slug.
    writeFileSync(
      join(docs, 'guides', 'items-adjust-stock.md'),
      ['---', 'title: Clash', 'category: Projects', 'keywords: [x]', 'audience: vendor', '---', '', '# Clash', ''].join('\n'),
    );
    const {result} = runTool(dir, docs);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Slug collision/);
    assert.match(result.stderr, /adjust-stock/);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

test('a page that exists but fails validation is BLOCKED, never orphaned', () => {
  const {dir, docs} = makeFixture();
  try {
    // Manifest knows bad-category.md under its slug; the file exists but its
    // category is invalid — it must land in blocked (kept), not orphan.
    const manifest = join(dir, 'kb-manifest.json');
    writeFileSync(
      manifest,
      JSON.stringify({pages: {'guides-items-bad-category': {sourcePath: 'guides/items/bad-category.md', hash: 'x', articleId: 7}}}),
    );
    const out = join(dir, 'kb-plan.json');
    const result = spawnSync(process.execPath, [TOOL, '--docs', docs, '--manifest', manifest, '--out', out], {encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    const plan = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(plan.plan.orphan.length, 0);
    assert.equal(plan.plan.blocked.length, 1);
    assert.equal(plan.plan.blocked[0].slug, 'guides-items-bad-category');
    assert.match(plan.plan.blocked[0].reason, /not a KB component/);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

test('the plan file never embeds the API base URL', () => {
  const {dir, docs} = makeFixture();
  try {
    const {result, out} = runTool(dir, docs);
    assert.equal(result.status, 0, result.stderr);
    const plan = JSON.parse(readFileSync(out, 'utf8'));
    assert.ok(!('baseUrl' in plan), 'kb-plan.json is a shareable artifact — no internal hostnames');
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});

test('manifest entries whose source page disappeared plan as ORPHAN', () => {
  const {dir, docs} = makeFixture();
  try {
    const manifest = join(dir, 'kb-manifest.json');
    writeFileSync(manifest, JSON.stringify({pages: {'guides-items-gone': {sourcePath: 'guides/items/gone.md', hash: 'x'}}}));
    const out = join(dir, 'kb-plan.json');
    const result = spawnSync(
      process.execPath,
      [TOOL, '--docs', docs, '--manifest', manifest, '--out', out],
      {encoding: 'utf8'},
    );
    assert.equal(result.status, 0, result.stderr);
    const plan = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(plan.plan.orphan.length, 1);
    assert.equal(plan.plan.orphan[0].slug, 'guides-items-gone');
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
