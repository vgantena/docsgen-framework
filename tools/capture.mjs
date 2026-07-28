#!/usr/bin/env node
/**
 * Screenshot capture for docs — consistent viewport, HiDPI, element highlight.
 *
 *   npm run capture -- --url /settings --out static/img/settings/api-keys.png
 *     [--highlight "#new-key-btn"]  outline an element (uses --doc-frame-highlight color)
 *     [--element ".modal"]          capture only that element
 *     [--full]                      full-page screenshot
 *     [--base http://localhost:3000]  overrides appUrl from site.config.ts
 *     [--width 1280 --height 800 --scale 2]
 *     [--timeout 30000]             navigation timeout in ms (default: Playwright's 30s)
 *     [--wait 500]                  extra settle delay in ms after load
 *     [--storage-state auth.json]   Playwright storageState JSON for authenticated
 *                                   pages (create one with: npx playwright codegen
 *                                   --save-storage=auth.json <app-url>, log in, close)
 */
import {chromium} from 'playwright';
import {existsSync, mkdirSync, readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {readSiteConfig} from './lib/site-config.mjs';

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

// .env (gitignored) can override the target app: APP_URL=… (see .env.example).
try {
  process.loadEnvFile?.(resolve('.env'));
} catch {
  /* no .env — fine */
}

const str = (v) => (typeof v === 'string' ? v : undefined);

/** Numeric flags must have numeric values — `--width` alone would otherwise become a 1px viewport. */
function num(name, fallback) {
  const v = args[name];
  if (v === undefined) return fallback;
  const n = Number(v);
  if (typeof v !== 'string' || v.trim() === '' || Number.isNaN(n)) {
    console.error(`--${name} needs a numeric value (got ${v === true ? 'no value' : JSON.stringify(v)}), e.g. --${name} ${fallback}`);
    process.exit(1);
  }
  return n;
}

const base = str(args.base) ?? process.env.APP_URL ?? readSiteConfig({quiet: true}).appUrl;
const urlArg = str(args.url) ?? '/';
const url = urlArg.startsWith('http') ? urlArg : new URL(urlArg, base).href;
const out = str(args.out);
if (!out) {
  console.error('Usage: npm run capture -- --url <path> --out <path.png> [--base <url>] [--highlight <sel>] [--element <sel>] [--full] [--timeout <ms>] [--wait <ms>] [--storage-state <auth.json>]');
  process.exit(1);
}

const width = num('width', 1280);
const height = num('height', 800);
const scale = num('scale', 2);
const timeout = num('timeout', 30_000);
const settle = num('wait', 0);

if (str(args.element) && args.full) {
  console.warn('⚠ Both --element and --full given — --element wins; the screenshot is only that element.');
}

const storageStatePath = str(args['storage-state']);
if (storageStatePath && !existsSync(resolve(storageStatePath))) {
  console.error(`--storage-state file not found: ${storageStatePath}`);
  console.error('Create one with: npx playwright codegen --save-storage=' + storageStatePath + ' <app-url> (log in, then close the browser).');
  process.exit(1);
}

/** Highlight color comes from the design tokens so screenshots match the site. */
function highlightColor() {
  const fallback = '#e5484d';
  try {
    const tokens = readFileSync(resolve('src/css/tokens.css'), 'utf8');
    const m = tokens.match(/--doc-frame-highlight:\s*(#[0-9a-fA-F]{3,8}|[a-z][a-z-]*\([^)]*\))/);
    if (m) return m[1];
    console.warn(`⚠ --doc-frame-highlight not found in src/css/tokens.css — using fallback ${fallback}.`);
  } catch {
    console.warn(`⚠ Could not read src/css/tokens.css — using fallback highlight color ${fallback}.`);
  }
  return fallback;
}

async function launch() {
  for (const channel of ['chrome', 'msedge']) {
    try {
      return await chromium.launch({channel});
    } catch {
      /* try next */
    }
  }
  return chromium.launch(); // bundled browser (requires: npx playwright install chromium)
}

const browser = await launch();
try {
  const page = await browser.newPage({
    viewport: {width, height},
    deviceScaleFactor: scale,
    ...(storageStatePath ? {storageState: resolve(storageStatePath)} : {}),
  });

  try {
    await page.goto(url, {waitUntil: 'networkidle', timeout});
  } catch (e) {
    if (/Timeout/i.test(e.message)) {
      console.error(`Timed out waiting for ${url} to go network-idle (${timeout}ms).`);
      console.error('Apps with websockets or polling never reach networkidle — raise --timeout, add --wait for a fixed settle delay, or check the URL.');
    } else {
      console.error(`Could not open ${url} — is the app running at ${base}? (${e.message.split('\n')[0]})`);
    }
    process.exitCode = 1;
    throw e;
  }

  if (settle > 0) await page.waitForTimeout(settle);

  if (str(args.highlight)) {
    await page.locator(args.highlight).first().evaluate((el, color) => {
      el.style.outline = `3px solid ${color}`;
      el.style.outlineOffset = '3px';
      el.style.borderRadius = '6px';
    }, highlightColor());
    await page.waitForTimeout(150);
  }

  mkdirSync(dirname(resolve(out)), {recursive: true});

  if (str(args.element)) {
    await page.locator(args.element).first().screenshot({path: out});
  } else {
    await page.screenshot({path: out, fullPage: Boolean(args.full)});
  }

  console.log(`Saved ${out} (${url})`);
} catch (e) {
  if (!process.exitCode) {
    console.error(`Capture failed: ${e.message.split('\n')[0]}`);
    console.error('Check the --highlight/--element selector and that the page finished loading.');
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
