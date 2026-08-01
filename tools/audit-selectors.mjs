#!/usr/bin/env node
/**
 * UI-drift guard — every [data-testid=…] selector the media tooling references
 * (tools/media/*.json manifests and tools/flows/*.mjs flows) must still exist
 * in the product app's source, or `npm run media` will silently time out or
 * capture the wrong element after the next UI refactor.
 *
 *   npm run audit:selectors -- --app <path-to-app-source-root>
 *   (or set APP_SRC in .env)
 *
 * The app root is scanned recursively for .tsx/.ts/.jsx/.js files (skipping
 * node_modules/dist/build). Each selector resolves to one of:
 *   found            the exact literal appears in the app source
 *   templated match  the app builds the id dynamically — our concrete
 *                    item-row-2-view matches data-testid={`item-row-${id}-view`},
 *                    and item-field-brand matches data-testid={`item-field-${name}`}
 *   MISSING          nothing matches — exits 1 and names the referencing file
 */
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {extname, join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseArgs, str} from './lib/args.mjs';

const USAGE = 'Usage: npm run audit:selectors -- --app <path-to-app-source-root>   (or set APP_SRC in .env)';

/**
 * Extract every data-testid value from OUR selector sources. Handles the
 * manifest form [data-testid=item-add] (also with ::highlight suffixes after
 * the bracket) and the flow form [data-testid="item-add"] (single quotes too).
 */
export function extractTestids(text) {
  const ids = [];
  const re = /\[data-testid=(?:"([^"\]]+)"|'([^'\]]+)'|([^\]"'\s][^\]\s]*))\]/g;
  for (const m of text.matchAll(re)) ids.push(m[1] ?? m[2] ?? m[3]);
  return ids;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Extract every template-form data-testid the app declares, e.g.
 * data-testid={`item-field-${name}`} → 'item-field-${name}'. Static
 * backtick values (no ${…}) are ignored — literal search already covers them.
 */
export function extractTemplateTestids(text) {
  const templates = [];
  const re = /data-testid\s*=\s*\{\s*`([^`]+)`/g;
  for (const m of text.matchAll(re)) {
    if (m[1].includes('${')) templates.push(m[1]);
  }
  return templates;
}

/** Turn 'item-row-${id}-view' into /^item-row-.+-view$/ (each slot ≥ 1 char). */
const templateToRegExp = (template) =>
  new RegExp(`^${template.split(/\$\{[^}]*\}/).map(escapeRe).join('.+')}$`);

/**
 * Resolve one selector id against the app source (array of file contents):
 *   'found'      the exact literal appears somewhere;
 *   'templated'  a declared template testid produces it (item-field-brand vs
 *                `item-field-${name}`), OR — for ids with numeric segments
 *                like item-row-2-view — the ${…}-interpolated form appears,
 *                or failing that the longest non-numeric prefix and suffix
 *                pieces both appear;
 *   'missing'    none of the above.
 * `templates` is the precomputed extractTemplateTestids() union — derived
 * from `contents` when omitted.
 */
export function matchTestid(id, contents, templates = contents.flatMap(extractTemplateTestids)) {
  if (contents.some((c) => c.includes(id))) return 'found';

  // The app declares the id as a template — any interpolation slots may
  // produce our concrete value.
  if (templates.some((t) => templateToRegExp(t).test(id))) return 'templated';

  const pieces = id.split(/\d+/);
  if (pieces.length > 1) {
    // item-row-2-view → /item-row-\$\{…\}-view/ matches `item-row-${item.id}-view`
    // wherever it appears (covers templates outside data-testid attributes).
    const templateRe = new RegExp(pieces.map(escapeRe).join('\\$\\{[^}]*\\}'));
    if (contents.some((c) => templateRe.test(c))) return 'templated';

    // Last resort for numeric ids the app assembles in other ways (string
    // concat, helper functions): the longest non-numeric prefix AND suffix
    // pieces must both appear somewhere.
    const longest = [pieces[0], pieces[pieces.length - 1]].filter((p) => p !== '');
    if (longest.length > 0 && longest.every((p) => contents.some((c) => c.includes(p)))) {
      return 'templated';
    }
  }
  return 'missing';
}

/** Recursively collect app source files under dir, skipping build artifacts. */
function collectSourceFiles(dir) {
  const SKIP = new Set(['node_modules', 'dist', 'build']);
  const EXTS = new Set(['.tsx', '.ts', '.jsx', '.js']);
  const out = [];
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name)) out.push(...collectSourceFiles(join(dir, entry.name)));
    } else if (entry.isFile() && EXTS.has(extname(entry.name).toLowerCase())) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

function main() {
  try {
    process.loadEnvFile?.(resolve('.env'));
  } catch {
    /* no .env — --app still works */
  }

  const {args} = parseArgs(process.argv.slice(2));
  const appRoot = str(args, 'app') ?? process.env.APP_SRC;
  if (!appRoot) {
    console.error('No app source root: pass --app <path> or set APP_SRC in .env.');
    console.error(USAGE);
    process.exit(1);
  }
  let rootStat;
  try {
    rootStat = statSync(resolve(appRoot));
  } catch {
    rootStat = null;
  }
  if (!rootStat?.isDirectory()) {
    console.error(`App source root is not a directory: ${appRoot}`);
    console.error(USAGE);
    process.exit(1);
  }

  // 1. Collect every selector our manifests and flows reference.
  const refs = new Map(); // id → Set of referencing files
  for (const [dir, ext] of [['tools/media', '.json'], ['tools/flows', '.mjs']]) {
    let entries;
    try {
      entries = readdirSync(resolve(dir));
    } catch {
      continue; // a freshly templated repo may not have both dirs yet
    }
    for (const name of entries) {
      if (extname(name).toLowerCase() !== ext) continue;
      const file = `${dir}/${name}`;
      for (const id of extractTestids(readFileSync(resolve(file), 'utf8'))) {
        if (!refs.has(id)) refs.set(id, new Set());
        refs.get(id).add(file);
      }
    }
  }
  if (refs.size === 0) {
    console.error('No [data-testid=…] selectors found in tools/media/*.json or tools/flows/*.mjs — nothing to audit.');
    process.exit(1);
  }

  // 2. Read the app source once.
  const appFiles = collectSourceFiles(resolve(appRoot));
  if (appFiles.length === 0) {
    console.error(`No .tsx/.ts/.jsx/.js files under ${appRoot} — is that the app's source root?`);
    process.exit(1);
  }
  const contents = appFiles.map((f) => readFileSync(f, 'utf8'));
  const templates = contents.flatMap(extractTemplateTestids);

  // 3. Resolve and report.
  const ids = [...refs.keys()].sort();
  const width = Math.max(...ids.map((id) => id.length), 'selector'.length);
  const LABEL = {found: 'found', templated: 'templated match', missing: 'MISSING'};
  let missing = 0;
  console.log(`Auditing ${ids.length} selectors against ${appFiles.length} app source files (${appRoot})\n`);
  console.log(`${'selector'.padEnd(width)}  status`);
  console.log(`${'-'.repeat(width)}  ${'-'.repeat(15)}`);
  for (const id of ids) {
    const status = matchTestid(id, contents, templates);
    const suffix = status === 'missing' ? `  ← referenced by ${[...refs.get(id)].join(', ')}` : '';
    console.log(`${id.padEnd(width)}  ${LABEL[status]}${suffix}`);
    if (status === 'missing') missing++;
  }
  console.log(`\n${ids.length - missing} of ${ids.length} selectors resolve (${missing} missing).`);
  if (missing > 0) {
    console.error('MISSING selectors mean the app renamed or removed those testids — update the manifests/flows above (or the app) before regenerating media.');
    process.exit(1);
  }
}

// Importable for tests (extractTestids / extractTemplateTestids / matchTestid)
// — only run the CLI when this file is invoked directly.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
