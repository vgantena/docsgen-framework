#!/usr/bin/env node
/**
 * Graduation step — remove the fictional "projects" product sample once the
 * repo has real content of its own.
 *
 *   npm run drop-sample -- --yes        remove it
 *   npm run drop-sample -- --dry-run    show what would go
 *
 * Why this exists: `init-product --fresh` deliberately KEEPS this sample so a
 * freshly adopted repo still builds (the navbar, the PDF manual and several
 * prose links all point into it). Nothing ever removed it afterwards, so
 * adopted sites shipped fictional Projects/workspaces pages beside their real
 * documentation, and the PDF manual kept rendering the sample instead of the
 * product.
 *
 * What it touches:
 *   - deletes the sample pages
 *   - prunes tools/pdf-manifest.json, docgen/manifest.json and
 *     docgen/kb-manifest.json of entries pointing at them
 *   - reports every remaining inbound reference (navbar items, prose links)
 *     for a human to rewrite — a script must not rewrite prose
 *
 * `npm run build` (onBrokenLinks: throw) is the backstop: it fails until every
 * reported reference is dealt with.
 */
import {existsSync, readdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join, relative, resolve} from 'node:path';
import {parseArgs} from './lib/args.mjs';

const {args} = parseArgs(process.argv.slice(2));
const dryRun = Boolean(args['dry-run']);

/** The fictional product surface. Authentication and webhooks stay: they are
 *  patterns worth adapting, and deleting them would gut the Developers section. */
const SAMPLE_PATHS = [
  'docs/guides/projects-and-workspaces.md',
  'docs/guides/managing-projects.md',
  'docs/developers/projects-api',
  'docs/developers/members-api',
  'docs/developers/files-api',
];

/** Routes the deleted pages served, used to find inbound references. */
const SAMPLE_ROUTES = [
  '/developers/projects-api',
  '/developers/members-api',
  '/developers/files-api',
  '/guides/projects-and-workspaces',
  '/guides/managing-projects',
];

const present = SAMPLE_PATHS.filter((path) => existsSync(resolve(path)));
if (present.length === 0) {
  console.log('Nothing to do — the projects sample is already gone.');
  process.exit(0);
}

if (!args.yes && !dryRun) {
  console.error('This deletes the projects sample permanently. Re-run with --yes (or --dry-run to preview).');
  process.exit(1);
}

/** Is this repo-relative page one of the things being deleted? */
const isRemoved = (page) => {
  const norm = String(page).replace(/\\/g, '/');
  return present.some((path) => norm === path || norm.startsWith(`${path}/`));
};

/* ── Find inbound references before anything disappears ─────────────── */

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (/\.(md|mdx)$/i.test(path)) out.push(path);
  }
  return out;
}

const inbound = [];
for (const file of walk(resolve('docs'))) {
  const rel = relative(resolve('.'), file).replace(/\\/g, '/');
  if (isRemoved(rel)) continue; // a page on its way out cannot dangle
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (SAMPLE_ROUTES.some((route) => line.includes(route))) {
        inbound.push(`${rel}:${i + 1}  ${line.trim().slice(0, 96)}`);
      }
    });
}

const navbarHits = readFileSync(resolve('site.config.ts'), 'utf8')
  .split(/\r?\n/)
  .map((line, i) => ({line: line.trim(), n: i + 1}))
  .filter(({line}) => SAMPLE_ROUTES.some((route) => line.includes(route)));

/* ── Delete ─────────────────────────────────────────────────────────── */

for (const path of present) {
  console.log(`${dryRun ? 'would remove' : 'removed'} ${path}`);
  if (!dryRun) rmSync(resolve(path), {recursive: true, force: true});
}

/* ── Prune the manifests that point at the deleted pages ────────────── */

/** Rewrite a JSON file if `mutate` reports removals. */
function pruneJson(path, what, mutate) {
  if (!existsSync(resolve(path))) return;
  let doc;
  try {
    doc = JSON.parse(readFileSync(resolve(path), 'utf8'));
  } catch {
    console.log(`  ! ${path} is not valid JSON — prune it by hand`);
    return;
  }
  const removed = mutate(doc);
  if (!removed.length) return;
  console.log(`${dryRun ? 'would prune' : 'pruned'} ${removed.length} ${what} from ${path}`);
  for (const entry of removed) console.log(`    - ${entry}`);
  if (!dryRun) writeFileSync(resolve(path), JSON.stringify(doc, null, 2) + '\n', 'utf8');
}

pruneJson('tools/pdf-manifest.json', 'chapter(s)', (doc) => {
  const removed = (doc.chapters ?? []).filter(isRemoved);
  doc.chapters = (doc.chapters ?? []).filter((chapter) => !isRemoved(chapter));
  return removed;
});

pruneJson('docgen/manifest.json', 'tracked page(s)', (doc) => {
  const removed = Object.keys(doc.pages ?? {}).filter(isRemoved);
  for (const page of removed) delete doc.pages[page];
  return removed;
});

// KB entries record sourcePath relative to docs/, e.g. "developers/projects-api/index.mdx".
pruneJson('docgen/kb-manifest.json', 'KB entry(ies)', (doc) => {
  const removed = Object.entries(doc.pages ?? {})
    .filter(([, meta]) => typeof meta?.sourcePath === 'string' && isRemoved(`docs/${meta.sourcePath}`))
    .map(([slug]) => slug);
  for (const slug of removed) delete doc.pages[slug];
  return removed;
});

/* ── Report what a human still has to do ────────────────────────────── */

const chapters = existsSync(resolve('tools/pdf-manifest.json'))
  ? (JSON.parse(readFileSync(resolve('tools/pdf-manifest.json'), 'utf8')).chapters ?? [])
  : [];

console.log('');
if (navbarHits.length) {
  console.log('site.config.ts still points at removed pages — repoint these:');
  for (const {line, n} of navbarHits) console.log(`  site.config.ts:${n}  ${line}`);
  console.log('');
}
if (inbound.length) {
  console.log(`${inbound.length} prose link(s) still reference the sample — rewrite them:`);
  for (const hit of inbound) console.log(`  ${hit}`);
  console.log('');
}
if (chapters.length === 0) {
  console.log('tools/pdf-manifest.json now has no chapters — add your real pages before npm run pdf.');
  console.log('');
}

console.log(
  dryRun
    ? 'Dry run — nothing was changed.'
    : 'Done. Run `npm run build` — it fails on broken links until every reference above is fixed.',
);
