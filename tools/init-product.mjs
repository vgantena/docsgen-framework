#!/usr/bin/env node
/**
 * One-command product adoption — rebrands site.config.ts and (optionally)
 * clears the worked-example content so a cloned repo becomes YOUR product's
 * docs in minutes. Steps 2–4 of the README adoption checklist.
 *
 *   npm run init-product -- --name "Acme Suite" --org "Acme Inc." \
 *     --org-url https://acme.example --app-url http://app.localhost \
 *     --docs-url https://docs.acme.example [--tagline "..."]
 *     [--fresh --yes]   also delete the worked-example module content
 *                       (items/parties guides + API pages + their media,
 *                       manifests, flows) and reset the KB manifest; the
 *                       generic "projects" sample stays so the build passes
 *     [--dry-run]       print every change without touching anything
 *
 * After running: review docgen.config.json (kb.components — YOUR category
 * vocabulary), rewrite tools/flows/login.mjs for your app, update the Vale
 * vocabulary, then: npm run brand-assets && npm run doctor.
 */
import {existsSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {readSiteConfig} from './lib/site-config.mjs';
import {parseArgs, str} from './lib/args.mjs';

const {args} = parseArgs(process.argv.slice(2));
const dryRun = Boolean(args['dry-run']);

// A required flag whose value was swallowed (e.g. `--name --org "X"`) arrives
// as `true` — str() returns undefined, so it lands in the missing list too.
const required = ['name', 'org', 'org-url', 'app-url', 'docs-url'];
const missing = required.filter((k) => str(args, k) === undefined);
if (missing.length > 0) {
  console.error(`Missing: ${missing.map((k) => `--${k}`).join(', ')}`);
  console.error('Usage: npm run init-product -- --name "Product" --org "Org Name" --org-url https://… --app-url http://… --docs-url https://… [--tagline "…"] [--fresh --yes] [--dry-run]');
  process.exit(1);
}

// ── Rebrand site.config.ts via anchored replacements ──
// Values are written into single-quoted TS strings: escape backslashes and
// single quotes so an apostrophe (or stray \) can never break the file.
const escapeTs = (v) => v.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const configPath = resolve('site.config.ts');
let config = readFileSync(configPath, 'utf8');
const edits = [
  [/(const org = \{[^}]*?name: ')([^']*)(')/s, str(args, 'org'), 'org.name'],
  [/(const org = \{[^}]*?url: ')([^']*)(')/s, str(args, 'org-url'), 'org.url'],
  [/(product: \{\s*name: ')([^']*)(')/s, str(args, 'name'), 'product.name'],
  // Anchored inside the product block so a `tagline:` elsewhere is never hit.
  ...(str(args, 'tagline') ? [[/(product: \{[\s\S]*?tagline: ')([^']*)(')/, str(args, 'tagline'), 'product.tagline']] : []),
  [/(deploy: \{[^}]*?url: ')([^']*)(')/s, str(args, 'docs-url'), 'deploy.url'],
  [/(appUrl: ')([^']*)(')/, str(args, 'app-url'), 'appUrl'],
];
let applied = 0;
for (const [pattern, value, label] of edits) {
  if (!pattern.test(config)) {
    console.error(`✗ could not locate ${label} in site.config.ts — edit it manually`);
    continue;
  }
  const before = config.match(pattern)[2];
  // Replacement FUNCTION: `$&`/`$1` sequences in the value are never expanded.
  const escaped = escapeTs(value);
  config = config.replace(pattern, (_m, p1, _old, p3) => p1 + escaped + p3);
  applied++;
  console.log(`${dryRun ? 'would set' : 'set'} ${label}: "${before}" → "${value}"`);
}
if (!dryRun && applied > 0) writeFileSync(configPath, config);

// ── Optional: clear the worked-example content ──
// These are the module guides a DOWNSTREAM repo accumulates (the shape the
// ui-guide skill produces). A fresh clone of the framework has none of them, so
// --fresh is a no-op here; it earns its keep when re-adopting a repo that
// already carries another product's guides. The framework's own media example
// (docs/guides/using-the-help-center.md + static/img/help-center) is NOT listed:
// it documents this site, not a product, and the component showcase renders it.
const WORKED_EXAMPLE = [
  'docs/guides/items',
  'docs/guides/parties',
  'docs/developers/items-api',
  'docs/framework/kb-coverage.md',
  'static/img/items',
  'static/img/parties',
  'static/video/items',
  'static/video/parties',
  'tools/media/items.json',
  'tools/media/parties.json',
  'tools/flows/items-tour.mjs',
  'tools/flows/add-item.mjs',
  'tools/flows/add-party.mjs',
  'docgen/kb-plan.json',
];

if (args.fresh) {
  if (!args.yes && !dryRun) {
    console.error('--fresh deletes the worked-example content permanently. Re-run with --yes to confirm (or --dry-run to preview).');
    process.exit(1);
  }
  for (const target of WORKED_EXAMPLE) {
    if (!existsSync(resolve(target))) continue;
    console.log(`${dryRun ? 'would remove' : 'removed'} ${target}`);
    if (!dryRun) rmSync(resolve(target), {recursive: true, force: true});
  }
  // The navbar's API Doc entry points at the worked example — repoint it at the
  // generic sample so the broken-link gate stays green.
  if (config.includes("'/developers/items-api/'")) {
    console.log(`${dryRun ? 'would repoint' : 'repointed'} navbar API Doc → /developers/projects-api/`);
    if (!dryRun) {
      config = config.replace("'/developers/items-api/'", "'/developers/projects-api/'");
      writeFileSync(configPath, config);
    }
  }
  console.log(`${dryRun ? 'would reset' : 'reset'} docgen/kb-manifest.json`);
  if (!dryRun) writeFileSync(resolve('docgen/kb-manifest.json'), JSON.stringify({pages: {}}, null, 2) + '\n');
}

if (dryRun) {
  console.log('\nDry run — nothing was changed.');
} else {
  const site = readSiteConfig({quiet: true});
  console.log(`\nBranding now: "${site.product?.name}" by ${site.org?.name}, app ${site.appUrl}.`);
  console.log('Next: review docgen.config.json (kb.components = YOUR categories), rewrite tools/flows/login.mjs,');
  console.log('update .vale vocabulary and template placeholders, then: npm run brand-assets && npm run doctor');
}
