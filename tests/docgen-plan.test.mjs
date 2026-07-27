import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

/**
 * CLI-level tests for tools/docgen-plan.mjs against the committed example
 * fixtures. spec-v2 + manifest.example is documented (docgen/README.md) to
 * exercise every plan action exactly once.
 */
function runPlan(spec, manifest) {
  const dir = mkdtempSync(join(tmpdir(), 'docgen-test-'));
  const out = join(dir, 'plan.json');
  const result = spawnSync(
    process.execPath,
    ['tools/docgen-plan.mjs', '--spec', spec, '--manifest', manifest, '--write', '--out', out],
    {encoding: 'utf8'},
  );
  assert.equal(result.status, 0, `planner exited ${result.status}: ${result.stderr}`);
  const plan = JSON.parse(readFileSync(out, 'utf8'));
  rmSync(dir, {recursive: true, force: true});
  return plan;
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
