#!/usr/bin/env node
/**
 * Screenshot capture for docs — consistent viewport, HiDPI, element highlight.
 *
 *   npm run capture -- --url /settings --out static/img/settings/api-keys.png
 *     [--highlight "#new-key-btn"]  outline an element (uses --doc-frame-highlight color).
 *                                   Repeatable. Append ::red | ::yellow | ::action to pick a
 *                                   token color, e.g. --highlight "[name=email]::yellow"
 *                                   (yellow = fill this in, red = destructive/attention,
 *                                   action = the button to press, default = coral)
 *     [--element ".modal"]          capture only that element
 *     [--full]                      full-page screenshot
 *     [--base http://localhost:3000]  overrides appUrl from site.config.ts
 *     [--width 1280 --height 800 --scale 2]  explicit override — avoid: ALL docs
 *                                   screenshots share the single 1280×800 frame.
 *                                   Tall modals/forms are captured as MULTIPLE
 *                                   section shots using --scroll, never a taller frame.
 *     [--timeout 30000]             navigation timeout in ms (default: Playwright's 30s)
 *     [--wait 500]                  extra settle delay in ms after load
 *     [--storage-state auth.json]   Playwright storageState JSON for authenticated
 *                                   pages (create one with: npx playwright codegen
 *                                   --save-storage=auth.json <app-url>, log in, close)
 *     [--click "#sel"]              click an element after load, before capturing —
 *                                   repeatable, clicks run in order; use for apps
 *                                   whose navigation is state-based (URL never changes)
 *     [--scroll "#sel"]             scroll an element into view (centered) before
 *                                   capturing — for highlights below the fold
 *     [--expect "#sel"]             assert an element is present after load (and
 *                                   clicks) before capturing — exits 1 if absent
 *                                   within 5s, so manifests never photograph a
 *                                   login screen when auth.json has gone stale
 */
import {chromium} from 'playwright';
import {existsSync, mkdirSync, readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {readSiteConfig} from './lib/site-config.mjs';
import {parseArgs, str, num} from './lib/args.mjs';

const {args, lists} = parseArgs(process.argv.slice(2), {multi: ['click', 'highlight']});
const clicks = lists.click;
const highlights = lists.highlight;

// .env (gitignored) can override the target app: APP_URL=… (see .env.example).
try {
  process.loadEnvFile?.(resolve('.env'));
} catch {
  /* no .env — fine */
}

const base = str(args, 'base') ?? process.env.APP_URL ?? readSiteConfig({quiet: true}).appUrl;
const urlArg = str(args, 'url') ?? '/';
const url = urlArg.startsWith('http') ? urlArg : new URL(urlArg, base).href;
const out = str(args, 'out');
if (!out) {
  console.error('Usage: npm run capture -- --url <path> --out <path.png> [--base <url>] [--highlight <sel[::red|yellow|action]>]... [--element <sel>] [--full] [--timeout <ms>] [--wait <ms>] [--storage-state <auth.json>] [--click <sel>]... [--scroll <sel>] [--expect <sel>]');
  process.exit(1);
}

const width = num(args, 'width', 1280);
const height = num(args, 'height', 800);
const scale = num(args, 'scale', 2);
const timeout = num(args, 'timeout', 30_000);
const settle = num(args, 'wait', 0);

if (str(args, 'element') && args.full) {
  console.warn('⚠ Both --element and --full given — --element wins; the screenshot is only that element.');
}

if (str(args, 'element') && highlights.length > 0) {
  console.warn('⚠ Both --element and --highlight given — highlight outlines sit OUTSIDE the element box and will be clipped from an element-only screenshot. Capture the parent element instead, or omit --element.');
}

const storageStatePath = str(args, 'storage-state');
if (storageStatePath && !existsSync(resolve(storageStatePath))) {
  console.error(`--storage-state file not found: ${storageStatePath}`);
  console.error('Create one with: npx playwright codegen --save-storage=' + storageStatePath + ' <app-url> (log in, then close the browser).');
  process.exit(1);
}

/** Highlight colors come from the design tokens so screenshots match the site. */
function highlightColor(name) {
  const fallback = name === 'yellow' ? '#f7b500' : name === 'action' ? '#2f6fed' : '#e5484d';
  const token = name ? `--doc-frame-highlight-${name}` : '--doc-frame-highlight';
  try {
    const tokens = readFileSync(resolve('src/css/tokens.css'), 'utf8');
    const m = tokens.match(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{3,8}|[a-z][a-z-]*\\([^)]*\\))`));
    if (m) return m[1];
    console.warn(`⚠ ${token} not found in src/css/tokens.css — using fallback ${fallback}.`);
  } catch {
    console.warn(`⚠ Could not read src/css/tokens.css — using fallback highlight color ${fallback}.`);
  }
  return fallback;
}

/** "sel::yellow" → {selector: "sel", color: <token value>}; bare "sel" uses the default token. */
function parseHighlight(spec) {
  const m = spec.match(/^(.*?)::(red|yellow|action)$/);
  return m ? {selector: m[1], color: highlightColor(m[2])} : {selector: spec, color: highlightColor()};
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

  for (const selector of clicks) {
    await page.locator(selector).first().click({timeout});
    // Websocket-y apps may never go idle — cap the per-click settle so N clicks
    // cannot silently stack N full --timeout waits.
    await page.waitForLoadState('networkidle', {timeout: Math.min(timeout, 5000)}).catch(() => {});
    if (settle > 0) await page.waitForTimeout(settle);
  }

  const expectSel = str(args, 'expect');
  if (expectSel) {
    try {
      await page.locator(expectSel).first().waitFor({timeout: 5000});
    } catch {
      console.error(`--expect "${expectSel}": expected element not found — is auth.json stale? re-run: npm run login`);
      process.exitCode = 1;
      throw new Error('expected element not found');
    }
  }

  if (str(args, 'scroll')) {
    await page.locator(str(args, 'scroll')).first().evaluate((el) => el.scrollIntoView({block: 'center'}), undefined, {timeout});
    await page.waitForTimeout(250);
  }

  for (const spec of highlights) {
    const {selector, color} = parseHighlight(spec);
    await page.locator(selector).first().evaluate((el, outlineColor) => {
      el.style.outline = `3px solid ${outlineColor}`;
      el.style.outlineOffset = '3px';
      el.style.borderRadius = '6px';
    }, color, {timeout});
  }
  if (highlights.length > 0) await page.waitForTimeout(150);

  mkdirSync(dirname(resolve(out)), {recursive: true});

  if (str(args, 'element')) {
    await page.locator(str(args, 'element')).first().screenshot({path: out});
  } else {
    await page.screenshot({path: out, fullPage: Boolean(args.full)});
  }

  console.log(`Saved ${out} (${url})`);
} catch (e) {
  if (!process.exitCode) {
    console.error(`Capture failed: ${e.message.split('\n')[0]}`);
    console.error('Check the --highlight/--element/--scroll selector and that the page finished loading.');
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
