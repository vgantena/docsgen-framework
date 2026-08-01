#!/usr/bin/env node
/**
 * Regenerate a module's docs media from its committed manifest — the single
 * source of truth for how every screenshot and video is produced, so a UI
 * change means one command, not a hunt through shell history.
 *
 *   npm run media -- --manifest tools/media/items.json
 *     [--only screenshots|videos]   regenerate one kind (default: both)
 *     [--filter <substring>]        only entries whose out path contains this
 *     [--base <url>]                overrides APP_URL / appUrl for every entry
 *     [--check]                     DRIFT DETECTION: re-shoot to a temp dir and
 *                                   pixel-diff against the committed screenshots
 *                                   instead of overwriting; exits 1 when any shot
 *                                   drifts past --drift-threshold percent
 *                                   (default 3). Run nightly to catch stale docs
 *                                   media after app UI changes. Videos skipped.
 *
 * Manifest shape (see tools/media/items.json):
 *   {
 *     "module": "items",
 *     "storageState": "auth.json",          // from: npm run login
 *     "screenshots": [{"out", "url", "clicks": [], "highlights": [],
 *                      "scroll", "wait", "element", "full"}],
 *                     // one standard 1280×800 frame for every shot — tall
 *                     // modals are split into several section shots via scroll
 *     "videos":      [{"flow", "out", "poster"}]
 *   }
 *
 * Screenshots are deterministic re-runs. Video flows DRIVE THE REAL APP and may
 * create records (an add-item walkthrough adds an item) — re-record them only
 * against demo data, and clean up records the flow created.
 */
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {PNG} from 'pngjs';
import pixelmatch from 'pixelmatch';
import {parseArgs, str, num} from './lib/args.mjs';

const USAGE = 'Usage: npm run media -- --manifest tools/media/<module>.json [--only screenshots|videos] [--filter <substring>] [--base <url>] [--check [--drift-threshold <pct>]]';

const {args} = parseArgs(process.argv.slice(2));

const manifestPath = str(args, 'manifest');
if (!manifestPath) {
  console.error(USAGE);
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(resolve(manifestPath), 'utf8'));
} catch (e) {
  console.error(`Could not read manifest ${manifestPath}: ${e.message.split('\n')[0]}`);
  process.exit(1);
}

// A flag-only `--only` (its value swallowed by another flag, e.g.
// `--only --filter x`) arrives as `true` — invalid, same as an unknown value.
const only = str(args, 'only');
if (args.only !== undefined && (only === undefined || (only !== 'screenshots' && only !== 'videos'))) {
  console.error(`--only must be "screenshots" or "videos", got ${only === undefined ? 'no value' : `"${only}"`}.`);
  console.error(USAGE);
  process.exit(1);
}
const filter = str(args, 'filter');
const wanted = (entry) => !filter || entry.out.includes(filter);
const base = str(args, 'base');

// --check: DRIFT DETECTION — re-shoot each screenshot to a temp file and
// pixel-compare it with the committed one. Screenshots that differ by more
// than --drift-threshold percent (default 3 — dynamic header text accounts
// for ~1-2%) mean the app's UI changed and the docs media is stale.
const check = Boolean(args.check);
const driftThreshold = num(args, 'drift-threshold', 3);
if (check && only === 'videos') {
  console.error('--check compares screenshots only — videos cannot be pixel-diffed meaningfully.');
  process.exit(1);
}

/** Percentage of differing pixels between two PNG files (100 on size mismatch). */
function driftPercent(pathA, pathB) {
  const a = PNG.sync.read(readFileSync(pathA));
  const b = PNG.sync.read(readFileSync(pathB));
  if (a.width !== b.width || a.height !== b.height) return 100;
  const differing = pixelmatch(a.data, b.data, null, a.width, a.height, {threshold: 0.1});
  return (differing / (a.width * a.height)) * 100;
}

// Fail fast on malformed screenshot entries — a missing "out" would otherwise
// surface as a confusing error mid-spawn (and break filtering).
(manifest.screenshots ?? []).forEach((shot, i) => {
  if (typeof shot.out !== 'string' || shot.out === '') {
    console.error(`${manifestPath}: screenshots[${i}] is missing "out"`);
    process.exit(1);
  }
});

let ok = 0;
let failed = 0;

function exec(script, scriptArgs, label) {
  // node is a real executable — no shell (and no quoting) needed on any
  // platform, so selectors with quotes/spaces/percent pass through untouched.
  const result = spawnSync(process.execPath, [script, ...scriptArgs], {stdio: 'inherit'});
  if (result.error || result.status !== 0) {
    failed++;
    console.error(`✗ ${label}`);
  } else {
    ok++;
  }
}

const drifted = [];
const checkDir = check ? mkdtempSync(join(tmpdir(), 'media-check-')) : null;

if (only !== 'videos') {
  let shotIndex = 0;
  for (const shot of (manifest.screenshots ?? []).filter(wanted)) {
    const outPath = check ? join(checkDir, `check-${shotIndex++}.png`) : shot.out;
    const a = ['--url', shot.url ?? '/', '--out', outPath];
    if (manifest.storageState) a.push('--storage-state', manifest.storageState);
    for (const c of shot.clicks ?? []) a.push('--click', c);
    for (const h of shot.highlights ?? []) a.push('--highlight', h);
    if (shot.scroll) a.push('--scroll', shot.scroll);
    if (shot.wait != null) a.push('--wait', String(shot.wait));
    if (shot.element) a.push('--element', shot.element);
    if (shot.full) a.push('--full');
    if (base) a.push('--base', base);
    exec('tools/capture.mjs', a, shot.out);
    if (check) {
      try {
        const pct = driftPercent(resolve(shot.out), outPath);
        const stale = pct > driftThreshold;
        if (stale) drifted.push({out: shot.out, pct});
        console.log(` ${stale ? '✗' : '✓'} ${shot.out}  drift ${pct.toFixed(2)}%${stale ? `  (> ${driftThreshold}%)` : ''}`);
      } catch (e) {
        drifted.push({out: shot.out, pct: 100});
        console.error(` ✗ ${shot.out}  could not compare: ${e.message.split('\n')[0]}`);
      }
    }
  }
}

if (only !== 'screenshots' && !check) {
  for (const video of (manifest.videos ?? []).filter(wanted)) {
    const a = ['--flow', video.flow, '--out', video.out];
    if (video.poster != null) a.push('--poster', String(video.poster));
    if (manifest.storageState) a.push('--storage-state', manifest.storageState);
    if (base) a.push('--base', base);
    exec('tools/record.mjs', a, video.out);
  }
}

if (filter && ok + failed === 0) {
  console.error(`filter matched no entries: "${filter}" (manifest ${manifestPath})`);
  process.exit(1);
}

if (checkDir) rmSync(checkDir, {recursive: true, force: true});

if (check) {
  console.log(`\nDrift check for "${manifest.module}": ${ok - drifted.length} fresh, ${drifted.length} stale, ${failed} failed (threshold ${driftThreshold}%).`);
  if (drifted.length > 0) {
    console.log('Stale media — the app UI changed. Re-shoot with: npm run media -- --manifest ' + manifestPath);
    process.exitCode = 1;
  }
  if (failed > 0) process.exitCode = 1;
} else {
  console.log(`\nMedia for "${manifest.module}": ${ok} regenerated, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}
