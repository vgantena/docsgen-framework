#!/usr/bin/env node
/**
 * KB export bridge — walks docs/, converts each KB-mapped page to plain
 * markdown (tools/lib/mdx-to-plain.mjs), and plans/performs an upsert into the
 * product's knowledge base keyed by slug. Sibling of docgen-plan.mjs: same
 * philosophy — deterministic diff first, writes only on --write, provenance in
 * a committed manifest so re-runs touch only what changed.
 *
 *   npm run docgen:kb-export                     # dry-run: print + write the plan
 *     [--write]      perform the upserts via the platform API and update the manifest
 *     [--archive-orphans]  with --write: set status "archived" on KB articles whose
 *                          source page was deleted, and drop them from the manifest.
 *                          Only true orphans qualify (source file gone from disk);
 *                          pages that still exist but were skipped by validation
 *                          plan as BLOCKED and are never archived
 *     [--docs docs]  docs tree to walk (default docs)
 *     [--manifest docgen/kb-manifest.json]
 *     [--out docgen/kb-plan.json]
 *     [--base <url>] platform API origin (default KB_BASE_URL from .env, else http://localhost)
 *
 * The written plan (docgen/kb-plan.json) contains the COMPLETE article payloads
 * and is a stable contract: products whose KB API differs can consume it with
 * their own uploader instead of --write.
 *
 * Only pages whose frontmatter carries the three KB fields participate:
 *   category  → kb_articles.category (must be in docgen.config.json → kb.components)
 *   keywords  → kb_articles.tags (comma-joined; synonyms feed retrieval ranking)
 *   audience  → kb_articles.visibility (vendor | internal)
 * Pages without a `category` (for example docs/framework/*) are ignored.
 *
 * Nothing product-specific is hardcoded here: the category vocabulary, API base
 * path, and body cap come from docgen.config.json (kb section); credentials and
 * host come from .env. --write needs KB_USER/KB_PASS — a platform account with
 * support-triage rights. Server-side kb_article_versions keeps history
 * automatically; status is always exported as "published".
 */
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {parseArgs, str as argStr} from './lib/args.mjs';
import {mdxToPlain} from './lib/mdx-to-plain.mjs';

let kbConfig;
try {
  kbConfig = JSON.parse(readFileSync(resolve('docgen.config.json'), 'utf8')).kb;
} catch {
  /* handled below */
}
if (!kbConfig || !Array.isArray(kbConfig.components) || kbConfig.components.length === 0) {
  console.error('docgen.config.json has no "kb" section (components/apiBasePath) — the KB export is configured per product there. See README "Knowledge-base export".');
  process.exit(1);
}
const KB_COMPONENTS = kbConfig.components;
const KB_API_BASE = kbConfig.apiBasePath ?? '/api/platform';
const KB_BODY_MAX = kbConfig.bodyMaxChars ?? 20_000;

const {args} = parseArgs(process.argv.slice(2));

try {
  process.loadEnvFile?.(resolve('.env'));
} catch {
  /* no .env — fine */
}

const docsDir = argStr(args, 'docs') ?? 'docs';
const manifestPath = argStr(args, 'manifest') ?? 'docgen/kb-manifest.json';
const outPath = argStr(args, 'out') ?? 'docgen/kb-plan.json';
const baseUrl = argStr(args, 'base') ?? process.env.KB_BASE_URL ?? 'http://localhost';

let manifest = {pages: {}};
try {
  manifest = JSON.parse(readFileSync(resolve(manifestPath), 'utf8'));
  if (!manifest.pages || typeof manifest.pages !== 'object') manifest = {pages: {}};
} catch {
  /* first run — empty manifest */
}

/** Stable slug from the docs-relative path: guides/items/add-edit-items → guides-items-add-edit-items. */
function slugOf(relPath) {
  return relPath
    .replace(/\.(md|mdx)$/i, '')
    .split(sep)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(resolve(dir), {withFileTypes: true})) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(p));
    else if (/\.(md|mdx)$/i.test(entry.name)) files.push(p);
  }
  return files;
}

const sha = (payload) => createHash('sha256').update(JSON.stringify(payload)).digest('hex');

const warnings = [];
const articles = [];
const slugSources = new Map(); // slug → docs-relative path, to catch collisions before a plan exists
const noArticleReasons = new Map(); // posix docs-relative path → why the page produced no article this run
for (const file of walk(docsDir)) {
  const relPath = relative(docsDir, resolve(file));
  const posixPath = relPath.split(sep).join('/');
  const {frontmatter, markdown} = mdxToPlain(readFileSync(resolve(file), 'utf8'));
  if (!frontmatter.category) {
    // Not KB-mapped (framework/meta pages) — also covers unparseable frontmatter.
    noArticleReasons.set(posixPath, 'page has no category — no longer KB-mapped');
    continue;
  }

  const category = String(frontmatter.category);
  if (!KB_COMPONENTS.includes(category)) {
    warnings.push(`${relPath}: category "${category}" is not a KB component — page skipped`);
    noArticleReasons.set(posixPath, `category "${category}" is not a KB component`);
    continue;
  }
  const audience = String(frontmatter.audience ?? 'vendor');
  if (!['vendor', 'internal'].includes(audience)) {
    warnings.push(`${relPath}: audience "${audience}" is not vendor|internal — page skipped`);
    noArticleReasons.set(posixPath, `audience "${audience}" is not vendor|internal`);
    continue;
  }
  const keywords = Array.isArray(frontmatter.keywords)
    ? frontmatter.keywords
    : String(frontmatter.keywords ?? '').split(',').map((k) => k.trim()).filter(Boolean);
  if (keywords.length === 0) warnings.push(`${relPath}: no keywords — retrieval ranking will suffer`);

  // The title renders separately in the KB — drop a leading H1 that repeats it.
  const body = markdown.replace(/^#\s+.*\n+/, '').trim();
  if (body.length > KB_BODY_MAX) {
    warnings.push(`${relPath}: body ${body.length} chars exceeds the ${KB_BODY_MAX} KB cap — page skipped`);
    noArticleReasons.set(posixPath, `body ${body.length} chars exceeds the ${KB_BODY_MAX} KB cap`);
    continue;
  }

  const slug = slugOf(relPath);
  const clash = slugSources.get(slug);
  if (clash) {
    console.error(`Slug collision: "${slug}" is produced by both "${clash}" and "${relPath}" — KB articles are keyed by slug, so one would silently overwrite the other. Rename one page.`);
    process.exit(1);
  }
  slugSources.set(slug, relPath);

  const payload = {
    slug,
    title: String(frontmatter.title ?? relPath),
    category,
    tags: keywords.join(', '),
    visibility: audience,
    status: 'published',
    body,
  };
  articles.push({relPath, payload, hash: sha(payload)});
}

const seen = new Set();
const plan = {add: [], update: [], skip: [], orphan: [], blocked: []};
for (const a of articles) {
  seen.add(a.payload.slug);
  const prev = manifest.pages[a.payload.slug];
  if (!prev) plan.add.push(a);
  else if (prev.hash !== a.hash) plan.update.push(a);
  else plan.skip.push(a);
}
for (const [slug, entry] of Object.entries(manifest.pages)) {
  if (seen.has(slug)) continue;
  // Orphan = the recorded source file is truly gone from the docs tree. A page
  // that still exists but was skipped this run (bad category/audience, body too
  // long, unparseable frontmatter) is BLOCKED: its live KB article must never
  // be archived, and the manifest entry is kept so a later fix resumes cleanly.
  const sourcePath = typeof entry.sourcePath === 'string' ? entry.sourcePath : '';
  if (sourcePath && existsSync(resolve(docsDir, sourcePath))) {
    plan.blocked.push({slug, reason: noArticleReasons.get(sourcePath) ?? 'page produced no article this run', ...entry});
  } else {
    plan.orphan.push({slug, ...entry});
  }
}

console.log(`KB export plan — docs "${docsDir}", manifest ${manifestPath}\n`);
for (const [action, list] of Object.entries(plan)) {
  if (list.length === 0) continue;
  console.log(`${action.toUpperCase()} (${list.length})`);
  for (const item of list) {
    if (action === 'orphan') console.log(`  ${item.slug}  [source page gone — archive manually in the KB]`);
    else if (action === 'blocked') console.log(`  ${item.slug}  [blocked: ${item.reason} — kept in the manifest, never archived]`);
    else console.log(`  ${item.payload.slug}  ←  ${item.relPath}  [${item.payload.category} · ${item.payload.visibility}]`);
  }
  console.log('');
}
for (const w of warnings) console.warn(`⚠ ${w}`);
const blockedNote = plan.blocked.length > 0 ? `, ${plan.blocked.length} blocked` : '';
console.log(`${articles.length} KB-mapped pages: ${plan.add.length} new, ${plan.update.length} changed, ${plan.skip.length} unchanged, ${plan.orphan.length} orphaned${blockedNote}.`);

mkdirSync(dirname(resolve(outPath)), {recursive: true});
const planJson = Object.fromEntries(
  Object.entries(plan).map(([action, list]) => [
    action,
    list.map((i) => (i.payload ? {...i.payload, sourcePath: i.relPath, hash: i.hash} : i)),
  ]),
);
// No baseUrl here on purpose: kb-plan.json is a shareable artifact and must not
// leak internal hostnames.
writeFileSync(resolve(outPath), JSON.stringify({warnings, plan: planJson}, null, 2) + '\n');
console.log(`Plan written to ${outPath}.`);

if (!args.write) {
  console.log('Dry run — pass --write to upsert via the platform API.');
  process.exit(0);
}

// ── Write mode: sign in, map existing slugs, POST/PUT, update the manifest ──
const user = process.env.KB_USER;
const pass = process.env.KB_PASS;
if (!user || !pass) {
  console.error('KB_USER and KB_PASS must be set in .env for --write (a platform support-triage account).');
  process.exit(1);
}

async function api(path, {method = 'GET', body, cookie} = {}) {
  const res = await fetch(`${baseUrl}${KB_API_BASE}${path}`, {
    method,
    headers: {'Content-Type': 'application/json', ...(cookie ? {cookie} : {})},
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return {res, json};
}

const login = await api('/auth/login', {method: 'POST', body: {identifier: user, password: pass}});
if (!login.res.ok || login.json.success === false) {
  console.error(`Platform login failed (${login.res.status}): ${login.json.message ?? 'unknown error'}`);
  process.exit(1);
}
// Prefer getSetCookie() when it returns a NON-EMPTY array; an empty array must
// fall through to the legacy single-header fallback, which may merge multiple
// Set-Cookie headers into one comma-joined value.
const setCookies = login.res.headers.getSetCookie?.();
const cookieHeaders = Array.isArray(setCookies) && setCookies.length > 0
  ? setCookies
  : [login.res.headers.get('set-cookie')].filter(Boolean);
const cookie = cookieHeaders.map((c) => c.split(';')[0]).join('; ');
if (cookie === '') {
  console.error('login returned no session cookie — check the platform auth endpoint');
  process.exit(1);
}

const existing = await api('/kb/articles', {cookie});
if (!existing.res.ok) {
  console.error(`Could not list existing KB articles (${existing.res.status}).`);
  process.exit(1);
}
const bySlug = new Map((existing.json.data ?? []).filter((a) => a.slug).map((a) => [a.slug, a]));

let wrote = 0;
let failed = 0;
let archived = 0;
try {
  for (const item of [...plan.add, ...plan.update]) {
    const {payload, hash, relPath} = item;
    try {
      const current = bySlug.get(payload.slug);
      const {res, json} = current
        ? await api(`/kb/articles/${current.id}`, {method: 'PUT', cookie, body: {...payload, note: 'docs export'}})
        : await api('/kb/articles', {method: 'POST', cookie, body: payload});
      if (res.ok && json.success !== false) {
        wrote++;
        manifest.pages[payload.slug] = {
          sourcePath: relPath.split(sep).join('/'),
          hash,
          articleId: json.data?.id ?? current?.id ?? null,
          exportedAt: new Date().toISOString(),
        };
        console.log(`✓ ${current ? 'updated' : 'created'} ${payload.slug} (#${json.data?.id ?? current?.id})`);
      } else {
        failed++;
        console.error(`✗ ${payload.slug}: ${json.message ?? `HTTP ${res.status}`}`);
      }
    } catch (err) {
      failed++;
      console.error(`✗ ${payload.slug}: ${err?.message ?? err} — continuing with the next article`);
    }
  }

  if (args['archive-orphans']) {
    for (const orphan of plan.orphan) {
      try {
        const id = orphan.articleId ?? bySlug.get(orphan.slug)?.id;
        if (!id) {
          console.warn(`⚠ orphan ${orphan.slug}: no matching KB article found — dropped from the manifest only`);
          delete manifest.pages[orphan.slug];
          continue;
        }
        const {res, json} = await api(`/kb/articles/${id}`, {
          method: 'PUT',
          cookie,
          body: {status: 'archived', note: 'docs export: source page removed'},
        });
        if (res.ok && json.success !== false) {
          archived++;
          delete manifest.pages[orphan.slug];
          console.log(`✓ archived ${orphan.slug} (#${id})`);
        } else {
          failed++;
          console.error(`✗ archive ${orphan.slug}: ${json.message ?? `HTTP ${res.status}`}`);
        }
      } catch (err) {
        failed++;
        console.error(`✗ archive ${orphan.slug}: ${err?.message ?? err} — continuing with the next orphan`);
      }
    }
  }
} finally {
  // Always persist what succeeded so a mid-run crash never loses provenance.
  writeFileSync(resolve(manifestPath), JSON.stringify(manifest, null, 2) + '\n');
}
console.log(`\nExported ${wrote} article(s), archived ${archived}, ${failed} failed. Manifest updated: ${manifestPath}.`);
if (plan.orphan.length > 0 && !args['archive-orphans']) {
  console.log(`${plan.orphan.length} orphaned manifest entr(ies) — re-run with --archive-orphans to archive them in the KB.`);
}
if (failed > 0) process.exitCode = 1;
