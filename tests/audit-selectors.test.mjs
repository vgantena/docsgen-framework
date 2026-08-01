/**
 * Unit tests for the selector-audit primitives (tools/audit-selectors.mjs) —
 * extraction from our manifests/flows and the found / templated / missing
 * resolution rules against app source contents.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractTestids, extractTemplateTestids, matchTestid} from '../tools/audit-selectors.mjs';

test('extractTestids handles the unquoted manifest form (with highlight suffixes)', () => {
  const json = `{
    "clicks": ["[data-testid=sidebar-nav-items]", "text=Delete"],
    "highlights": ["[data-testid=item-search]::yellow", "[data-testid=item-add]::action"]
  }`;
  assert.deepEqual(extractTestids(json), ['sidebar-nav-items', 'item-search', 'item-add']);
});

test('extractTestids handles quoted flow selectors (double and single)', () => {
  const flow = `
    await ui.click('[data-testid="sidebar-group-inventory"]');
    await page.locator("[data-testid='item-view-close']").click();
  `;
  assert.deepEqual(extractTestids(flow), ['sidebar-group-inventory', 'item-view-close']);
});

test('extractTestids ignores non-testid selectors', () => {
  assert.deepEqual(extractTestids('page.locator("text=Delete"); page.locator("#save");'), []);
});

test('extractTemplateTestids collects template declarations, skips static ones', () => {
  const tsx = `
    <td data-testid={\`item-row-\${item.id}-view\`} />
    <input data-testid={\`item-field-\${name}\`} />
    <td data-testid={\`static-in-braces\`} />
    <input data-testid="item-search" />
  `;
  assert.deepEqual(extractTemplateTestids(tsx), ['item-row-${item.id}-view', 'item-field-${name}']);
});

test('matchTestid: exact literal anywhere in the app source is "found"', () => {
  const contents = ['<input data-testid="item-search" />'];
  assert.equal(matchTestid('item-search', contents), 'found');
});

test('matchTestid: numeric segments match template interpolation as "templated"', () => {
  const contents = ['<td data-testid={`item-row-${item.id}-view`} />'];
  assert.equal(matchTestid('item-row-2-view', contents), 'templated');
  assert.equal(matchTestid('item-row-42-view', contents), 'templated');
  assert.equal(matchTestid('item-row-2-edit', contents), 'missing');
});

test('matchTestid: non-numeric id matches a declared template as "templated"', () => {
  // The app renders form fields generically — item-field-brand has no digits,
  // so the numeric fallback never fires; the declared template must match.
  const contents = ['<input data-testid={`item-field-${name}`} />'];
  assert.equal(matchTestid('item-field-brand', contents), 'templated');
  assert.equal(matchTestid('party-field-phone', contents), 'missing');
});

test('matchTestid: trailing-numeric id matches a trailing interpolation', () => {
  const contents = ['<button data-testid={`party-actions-${p.id}`}>…</button>'];
  assert.equal(matchTestid('party-actions-13', contents), 'templated');
});

test('matchTestid: prefix/suffix fallback covers string-concat testids', () => {
  // No exact template form — the app assembles the id another way; the
  // longest non-numeric prefix AND suffix pieces must both appear.
  const contents = ['const rowTestId = (id, act) => "item-row-" + id + "-" + act; // -view'];
  assert.equal(matchTestid('item-row-7-view', contents), 'templated');
});

test('matchTestid: nothing similar is "missing"', () => {
  const contents = ['<input data-testid="item-search" />'];
  assert.equal(matchTestid('order-export', contents), 'missing');
});
