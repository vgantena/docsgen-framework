#!/usr/bin/env node
/**
 * Incremental docs pipeline — change-plan generator.
 *
 * Diffs a freshly extracted OpenAPI spec (JSON) against docgen/manifest.json
 * and produces a deterministic plan: which doc pages to ADD, UPDATE, REMOVE,
 * REVIEW (human-edited page with upstream change), or SKIP (untouched —
 * the consistency guarantee).
 *
 *   npm run docgen:plan -- --spec path/to/openapi.json [--source backend] [--write]
 *
 *     --spec      Path to the new OpenAPI JSON (YAML: convert first).
 *     --source    Source id from docgen.config.json (default: first api source).
 *     --manifest  Manifest path (default docgen/manifest.json) — used by tests.
 *     --write     Also write the machine-readable plan (default docgen/plan.json).
 *     --out       Where --write puts the plan.
 *     --adopt     Register untracked pages (see below) into the manifest as
 *                 humanEdited, so they stop being planned as ADD.
 *
 * Untracked pages: a page that already exists on disk at the path an operation
 * would generate to, but that the manifest knows nothing about, is hand-authored
 * content. Planning it as ADD would propose writing over someone's work, so it
 * is routed to REVIEW instead — the planner never generates over a file it does
 * not own.
 *
 * Change detection is per-operation: each operation is hashed together with
 * every $ref it (transitively) uses, so a schema change marks exactly the
 * operations that consume that schema — a refactor that doesn't change the
 * contract changes nothing.
 */
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) {
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
}

const strArg = (v) => (typeof v === 'string' ? v : undefined);

if (!strArg(args.spec) || (args.source !== undefined && !strArg(args.source))) {
  console.error('Usage: npm run docgen:plan -- --spec <openapi.json> [--source <id>] [--manifest <path>] [--write] [--out <path>]');
  process.exit(1);
}

function readJson(path, what, hint) {
  try {
    return JSON.parse(readFileSync(resolve(path), 'utf8'));
  } catch (e) {
    console.error(`Could not read ${what} (${path}): ${e.code === 'ENOENT' ? 'file not found' : e.message}`);
    console.error(`  ${hint}`);
    process.exit(1);
  }
}

const config = readJson('docgen.config.json', 'pipeline config', 'Run the planner from the repo root — docgen.config.json defines the sources.');
const manifestPath = strArg(args.manifest) ?? 'docgen/manifest.json';
const manifest = readJson(manifestPath, 'manifest', 'The provenance manifest is committed at docgen/manifest.json (see docgen/README.md); pass --manifest to use another.');
const spec = readJson(args.spec, 'OpenAPI spec', 'Pass --spec a path to an extracted OpenAPI JSON file (YAML: convert first).');

if (!manifest.pages || typeof manifest.pages !== 'object') {
  console.error(`Manifest ${manifestPath} has no "pages" object — is it a valid provenance manifest? (see docgen/examples/empty-manifest.json)`);
  process.exit(1);
}

const source = args.source
  ? config.sources.find((s) => s.id === args.source)
  : config.sources.find((s) => s.type === 'api');
if (!source) {
  console.error(`No matching source in docgen.config.json${args.source ? ` for id "${args.source}"` : ''}`);
  process.exit(1);
}
if (source.type !== 'api') {
  console.error(
    `Source "${source.id}" has type "${source.type}" — the planner diffs OpenAPI specs and only works with sources of type "api". Pick an api source with --source <id>.`,
  );
  process.exit(1);
}

/* ── Stable hashing ─────────────────────────────────────────────────── */

const sortKeys = (value) => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, sortKeys(value[k])]),
    );
  }
  return value;
};

const hash = (value) =>
  createHash('sha256').update(JSON.stringify(sortKeys(value))).digest('hex').slice(0, 16);

/* ── $ref resolution: an operation's hash includes every schema it uses ─ */

function collectRefs(node, out = new Set()) {
  if (Array.isArray(node)) {
    node.forEach((n) => collectRefs(n, out));
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === '$ref' && typeof v === 'string') out.add(v);
      else collectRefs(v, out);
    }
  }
  return out;
}

function resolveRef(ref) {
  if (!ref.startsWith('#/')) return undefined; // external refs: hash the string only
  let node = spec;
  for (const part of ref.slice(2).split('/')) {
    node = node?.[part.replace(/~1/g, '/').replace(/~0/g, '~')];
  }
  return node;
}

/* ── Enumerate operations with contract hashes ──────────────────────── */

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

const warnings = [];

function operationsOf() {
  const ops = {};
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    if (item.$ref) {
      warnings.push(`path-item $ref not supported: ${path} → ${item.$ref} (its operations are invisible to the planner)`);
      continue;
    }
    for (const method of METHODS) {
      const op = item[method];
      if (!op) continue;
      const id = op.operationId ?? `${method.toUpperCase()} ${path}`;
      if (!op.operationId) {
        warnings.push(`missing operationId for ${method.toUpperCase()} ${path} — identity falls back to method+path (renames will churn as ADD+REMOVE)`);
      }
      if (ops[id]) {
        warnings.push(`duplicate operationId "${id}" — later definition wins`);
      }
      const refs = {};
      const queue = [...collectRefs(op), ...collectRefs(item.parameters ?? [])];
      const seen = new Set();
      while (queue.length) {
        const ref = queue.pop();
        if (seen.has(ref)) continue;
        seen.add(ref);
        const def = resolveRef(ref);
        if (def !== undefined) {
          refs[ref] = def;
          queue.push(...collectRefs(def));
        }
      }
      ops[id] = {
        path,
        method: method.toUpperCase(),
        summary: op.summary ?? '',
        tags: op.tags ?? [],
        hash: hash({op, pathParams: item.parameters ?? null, refs}),
      };
    }
  }
  return ops;
}

const specOps = operationsOf();

/* ── Cross with the manifest → plan ─────────────────────────────────── */

const kebab = (s) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

// Only pages owned by the selected source take part in the plan — planning
// source A must never propose REVIEW/REMOVE for source B's pages.
const sourcePages = Object.entries(manifest.pages).filter(([, meta]) => meta.source === source.id);

const opToPage = {};
for (const [page, meta] of sourcePages) {
  for (const opId of meta.operations ?? []) opToPage[opId] = page;
}

const templateStale = manifest.templateVersion !== config.templateVersion;
const plan = {ADD: [], UPDATE: [], REVIEW: [], REMOVE: [], SKIP: []};

const suggested = new Set(Object.keys(manifest.pages));
const suggestPage = (opId, op) => {
  // Prefer resource-scoped paths (per the repo standard docs/developers/<resource>-api/)
  // using the operation's first OpenAPI tag when available.
  const tag = op.tags?.[0] ? `${kebab(op.tags[0])}-api/` : '';
  const first = `${source.output}/${tag}${kebab(opId)}.mdx`;

  // On disk but absent from the manifest → hand-authored content the planner
  // does not own. Report it as untracked rather than renaming past it: writing
  // create-item-2.mdx beside a perfectly good create-item.mdx helps nobody.
  if (!suggested.has(first) && existsSync(resolve(first))) {
    suggested.add(first);
    return {page: first, untracked: true};
  }

  let candidate = first;
  let n = 2;
  while (suggested.has(candidate) || existsSync(resolve(candidate))) {
    candidate = candidate.replace(/(-\d+)?\.mdx$/, `-${n}.mdx`);
    warnings.push(`suggested page collision for "${opId}" — using ${candidate}`);
    n++;
  }
  suggested.add(candidate);
  return {page: candidate, untracked: false};
};

for (const [opId, op] of Object.entries(specOps)) {
  const page = opToPage[opId];
  if (!page) {
    const {page: target, untracked} = suggestPage(opId, op);
    if (untracked) {
      warnings.push(
        `${target} already exists but is not tracked in ${manifestPath} — not planning it as ADD`,
      );
      plan.REVIEW.push({
        op: opId,
        endpoint: `${op.method} ${op.path}`,
        page: target,
        hash: op.hash,
        untracked: true,
        reason:
          'page exists on disk but the manifest does not track it — register it (rerun with --adopt) or delete it',
      });
      continue;
    }
    plan.ADD.push({
      op: opId,
      endpoint: `${op.method} ${op.path}`,
      hash: op.hash,
      suggestedPage: target,
    });
    continue;
  }
  const meta = manifest.pages[page];
  const oldHash = meta.operationHashes?.[opId];
  const entry = {op: opId, endpoint: `${op.method} ${op.path}`, page, hash: op.hash, oldHash};
  if (templateStale) {
    plan.UPDATE.push({...entry, reason: 'templateVersion bump — full regeneration'});
  } else if (oldHash === op.hash) {
    plan.SKIP.push(entry);
  } else if (meta.humanEdited) {
    plan.REVIEW.push({
      ...entry,
      reason:
        oldHash === undefined
          ? 'no baseline hash recorded for this operation; review the page against the spec'
          : 'contract changed but page is human-edited',
    });
  } else {
    plan.UPDATE.push({
      ...entry,
      reason:
        oldHash === undefined
          ? 'no baseline hash recorded for this operation — regenerate from the spec'
          : 'contract changed',
    });
  }
}

// Removals are scoped: only propose deleting a PAGE when none of its
// operations survive; otherwise propose removing just the operation's section.
for (const [opId, page] of Object.entries(opToPage)) {
  if (specOps[opId]) continue;
  const meta = manifest.pages[page];
  const surviving = (meta.operations ?? []).filter((id) => id !== opId && specOps[id]);
  const scope = surviving.length ? 'operation' : 'page';
  const entry = {
    op: opId,
    page,
    scope,
    reason:
      scope === 'page'
        ? 'operation no longer in spec — no other operations use this page'
        : `operation no longer in spec — page keeps: ${surviving.join(', ')}`,
  };
  if (meta.humanEdited) {
    plan.REVIEW.push({...entry, reason: `${entry.reason} (page is human-edited)`});
  } else {
    plan.REMOVE.push(entry);
  }
}

/* ── Report ─────────────────────────────────────────────────────────── */

const total = Object.keys(specOps).length;
console.log(`Docgen change plan — source "${source.id}", spec ${args.spec}`);
console.log(
  `templateVersion: manifest ${manifest.templateVersion} vs config ${config.templateVersion}${templateStale ? '  ⚠ STALE (full regeneration)' : ''}`,
);
console.log('');

for (const warning of warnings) {
  console.warn(`⚠ ${warning}`);
}
if (warnings.length) console.log('');

for (const [action, list] of Object.entries(plan)) {
  if (!list.length) continue;
  console.log(`${action} (${list.length})`);
  for (const item of list) {
    const target = item.page ?? item.suggestedPage;
    const scope = item.scope === 'operation' ? ' (section only)' : '';
    console.log(`  ${item.endpoint ?? item.op}  →  ${target}${scope}${item.reason ? `  [${item.reason}]` : ''}`);
  }
  console.log('');
}
console.log(
  `${total} operations in spec: ${plan.SKIP.length} untouched, ${plan.ADD.length} new, ${plan.UPDATE.length} to regenerate, ${plan.REVIEW.length} need human review, ${plan.REMOVE.length} to remove.`,
);

if (args.write) {
  const outPath = strArg(args.out) ?? 'docgen/plan.json';
  const out = {
    generatedFrom: args.spec,
    source: source.id,
    templateStale,
    specHash: hash(spec),
    warnings,
    plan,
  };
  mkdirSync(dirname(resolve(outPath)), {recursive: true});
  writeFileSync(resolve(outPath), JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`\nWrote ${outPath}`);
}

/* ── --adopt: take ownership of untracked pages ─────────────────────── */

if (args.adopt) {
  const untracked = plan.REVIEW.filter((entry) => entry.untracked);
  if (!untracked.length) {
    console.log('\n--adopt: nothing to adopt — every planned page is already tracked.');
  } else {
    for (const entry of untracked) {
      const existing = manifest.pages[entry.page];
      if (existing) {
        existing.operations = [...new Set([...(existing.operations ?? []), entry.op])];
        existing.humanEdited = true;
      } else {
        // No recorded hashes: the next run routes the page to REVIEW ("no
        // baseline hash recorded"), which is the honest state — nobody has
        // checked this hand-written page against the spec yet.
        manifest.pages[entry.page] = {
          source: source.id,
          operations: [entry.op],
          operationHashes: {},
          sourceFiles: {},
          humanEdited: true,
          generatedAt: null,
        };
      }
    }
    writeFileSync(resolve(manifestPath), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    console.log(`\nAdopted ${untracked.length} untracked page(s) into ${manifestPath} as humanEdited:`);
    for (const entry of untracked) console.log(`  ${entry.page}  ←  ${entry.op}`);
    console.log('Rerun the planner to see the settled plan.');
  }
}
