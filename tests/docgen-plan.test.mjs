import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

/**
 * CLI-level tests for tools/docgen-plan.mjs against the committed example
 * fixtures. spec-v2 + manifest.example is documented (docgen/README.md) to
 * exercise every plan action exactly once.
 */
function runPlanRaw(spec, manifest, extraArgs = []) {
  const dir = mkdtempSync(join(tmpdir(), 'docgen-test-'));
  const out = join(dir, 'plan.json');
  const result = spawnSync(
    process.execPath,
    ['tools/docgen-plan.mjs', '--spec', spec, '--manifest', manifest, '--write', '--out', out, ...extraArgs],
    {encoding: 'utf8'},
  );
  let plan = null;
  if (result.status === 0) plan = JSON.parse(readFileSync(out, 'utf8'));
  rmSync(dir, {recursive: true, force: true});
  return {result, plan};
}

function runPlan(spec, manifest, extraArgs = []) {
  const {result, plan} = runPlanRaw(spec, manifest, extraArgs);
  assert.equal(result.status, 0, `planner exited ${result.status}: ${result.stderr}`);
  return plan;
}

/** Write a fixture JSON file into a fresh temp dir; returns [dir, path]. */
function tmpFixture(name, value) {
  const dir = mkdtempSync(join(tmpdir(), 'docgen-fixture-'));
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify(value, null, 2), 'utf8');
  return [dir, path];
}

test('first run against an empty manifest plans everything as ADD', () => {
  const {plan} = runPlan('docgen/examples/spec-v1.example.json', 'docgen/examples/empty-manifest.json');
  assert.equal(plan.ADD.length, 4);
  assert.equal(plan.UPDATE.length + plan.REVIEW.length + plan.REMOVE.length + plan.SKIP.length, 0);
});

test('spec-v2 against the populated manifest yields one of each action', () => {
  const {plan} = runPlan('docgen/examples/spec-v2.example.json', 'docgen/examples/manifest.example.json');
  assert.equal(plan.ADD.length, 1, 'getProject is new');
  assert.equal(plan.UPDATE.length, 1, 'listProjects schema changed');
  assert.equal(plan.REVIEW.length, 1, 'createProject changed but human-edited');
  assert.equal(plan.REMOVE.length, 1, 'deleteProject gone');
  assert.equal(plan.SKIP.length, 1, 'healthCheck untouched');
  assert.equal(plan.REMOVE[0].scope, 'page', 'sole-operation page removal is page-scoped');
});

test('hashes are stable: same spec twice → all SKIP', () => {
  const first = runPlan('docgen/examples/spec-v1.example.json', 'docgen/examples/manifest.example.json');
  assert.equal(first.plan.SKIP.length, 4, 'recorded v1 hashes still match v1 spec');
  assert.equal(first.plan.UPDATE.length + first.plan.ADD.length + first.plan.REMOVE.length, 0);
});

test('an operation removed from a shared page is operation-scoped, not page deletion', () => {
  const {plan} = runPlan('docgen/examples/spec-v2.example.json', 'docgen/examples/shared-page-manifest.json');
  const removal = [...plan.REMOVE, ...plan.REVIEW].find((r) => r.op === 'deleteProject');
  assert.ok(removal, 'deleteProject removal planned');
  assert.equal(removal.scope, 'operation', 'page with surviving ops must not be deleted');
});

test('operation tags produce resource-scoped suggested paths (<resource>-api/)', () => {
  const [dir, spec] = tmpFixture('spec.json', {
    openapi: '3.0.0',
    info: {title: 'Tagged API', version: '1.0.0'},
    paths: {
      '/v1/widgets': {
        get: {operationId: 'listWidgets', tags: ['Widgets'], responses: {200: {description: 'OK'}}},
      },
      '/v1/untagged': {
        get: {operationId: 'untaggedOp', responses: {200: {description: 'OK'}}},
      },
    },
  });
  const {plan} = runPlan(spec, 'docgen/examples/empty-manifest.json');
  rmSync(dir, {recursive: true, force: true});
  const tagged = plan.ADD.find((a) => a.op === 'listWidgets');
  const untagged = plan.ADD.find((a) => a.op === 'untaggedOp');
  assert.equal(tagged.suggestedPage, 'docs/developers/widgets-api/list-widgets.mdx');
  assert.equal(untagged.suggestedPage, 'docs/developers/untagged-op.mdx', 'no tag → no resource folder');
});

test('planning one source ignores pages owned by another source', () => {
  const [dir, manifest] = tmpFixture('manifest.json', {
    templateVersion: '1.0.0',
    specHash: null,
    generatedAt: null,
    pages: {
      'docs/guides/some-ui-page.mdx': {
        source: 'webapp',
        operations: ['listProjects', 'ghostOperation'],
        operationHashes: {},
        sourceFiles: {},
        humanEdited: false,
        generatedAt: null,
      },
    },
  });
  const {plan} = runPlan('docgen/examples/spec-v1.example.json', manifest);
  rmSync(dir, {recursive: true, force: true});
  // The webapp page must not absorb the spec's operations…
  assert.ok(
    plan.ADD.some((a) => a.op === 'listProjects'),
    'listProjects planned as ADD, not matched to the other source page',
  );
  // …and its stale operation must not be proposed for removal/review.
  assert.equal(plan.REMOVE.length, 0, 'no REMOVE for another source page');
  assert.equal(plan.REVIEW.length, 0, 'no REVIEW for another source page');
});

test('--source pointing at a non-api source fails with a clear error', () => {
  const {result} = runPlanRaw('docgen/examples/spec-v1.example.json', 'docgen/examples/empty-manifest.json', [
    '--source',
    'webapp',
  ]);
  assert.equal(result.status, 1, 'planner must exit non-zero');
  assert.match(result.stderr, /type "ui"/);
  assert.match(result.stderr, /type "api"/);
});

/**
 * A spec operation whose generated path collides with a page that already
 * exists in the repo (docs/developers/projects-api/create-project.mdx) but that
 * the manifest does not track. Tagging drives the path: "Projects" → projects-api/.
 */
const COLLIDING_SPEC = {
  openapi: '3.0.0',
  info: {title: 'collide', version: '1'},
  paths: {
    '/projects': {
      post: {operationId: 'createProject', tags: ['Projects'], responses: {200: {description: 'ok'}}},
    },
    '/widgets': {
      get: {operationId: 'listWidgets', tags: ['Widgets'], responses: {200: {description: 'ok'}}},
    },
  },
};

test('a page on disk that the manifest does not track is never planned as ADD', () => {
  const [dir, spec] = tmpFixture('spec.json', COLLIDING_SPEC);
  const {plan, warnings} = runPlan(spec, 'docgen/examples/empty-manifest.json');
  rmSync(dir, {recursive: true, force: true});

  assert.deepEqual(
    plan.ADD.map((a) => a.op),
    ['listWidgets'],
    'only the operation with no page on disk is an ADD',
  );
  const [review] = plan.REVIEW;
  assert.equal(review.op, 'createProject');
  assert.equal(review.page, 'docs/developers/projects-api/create-project.mdx');
  assert.equal(review.untracked, true);
  assert.ok(
    warnings.some((w) => w.includes('not tracked')),
    'the collision is warned about, not silently absorbed',
  );
  // The old behaviour renamed past the collision; that must not come back.
  assert.ok(
    !plan.ADD.some((a) => /create-project-\d+\.mdx$/.test(a.suggestedPage)),
    'no -2 duplicate is invented beside the existing page',
  );
});

test('--adopt registers untracked pages as humanEdited and settles the plan', () => {
  const [dir, manifest] = tmpFixture('manifest.json', {
    templateVersion: '1.0.0',
    specHash: null,
    generatedAt: null,
    pages: {},
  });
  const [specDir, spec] = tmpFixture('spec.json', COLLIDING_SPEC);

  runPlan(spec, manifest, ['--adopt']);

  const written = JSON.parse(readFileSync(manifest, 'utf8'));
  const entry = written.pages['docs/developers/projects-api/create-project.mdx'];
  assert.ok(entry, 'the untracked page is now in the manifest');
  assert.equal(entry.humanEdited, true, 'adopted pages are never overwritten later');
  assert.deepEqual(entry.operations, ['createProject']);
  assert.deepEqual(entry.operationHashes, {}, 'no baseline is invented for an unreviewed page');

  // Second run: the page is tracked, so it stops being untracked and routes to
  // REVIEW on the honest "no baseline hash" reason instead.
  const second = runPlan(spec, manifest);
  rmSync(dir, {recursive: true, force: true});
  rmSync(specDir, {recursive: true, force: true});
  assert.deepEqual(
    second.plan.ADD.map((a) => a.op),
    ['listWidgets'],
    'the adopted page is no longer proposed for generation',
  );
  assert.equal(second.plan.REVIEW.length, 1);
  assert.ok(!second.plan.REVIEW[0].untracked, 'it is tracked now');
  assert.match(second.plan.REVIEW[0].reason, /no baseline hash/);
});
