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
 */
import {chromium} from 'playwright';
import {mkdirSync, readFileSync} from 'node:fs';
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

function appUrlFromConfig() {
  try {
    const cfg = readFileSync(resolve('site.config.ts'), 'utf8');
    const m = cfg.match(/appUrl:\s*'([^']+)'/);
    return m ? m[1] : 'http://localhost:3000';
  } catch {
    return 'http://localhost:3000';
  }
}

// .env (gitignored) can override the target app: APP_URL=… (see .env.example).
try {
  process.loadEnvFile?.(resolve('.env'));
} catch {
  /* no .env — fine */
}

const str = (v) => (typeof v === 'string' ? v : undefined);
const base = str(args.base) ?? process.env.APP_URL ?? appUrlFromConfig();
const urlArg = str(args.url) ?? '/';
const url = urlArg.startsWith('http') ? urlArg : new URL(urlArg, base).href;
const out = str(args.out);
if (!out) {
  console.error('Usage: npm run capture -- --url <path> --out <path.png> [--base <url>] [--highlight <sel>] [--element <sel>] [--full]');
  process.exit(1);
}

const HIGHLIGHT = '#e5484d'; // keep in sync with --doc-frame-highlight in tokens.css

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
    viewport: {width: Number(args.width ?? 1280), height: Number(args.height ?? 800)},
    deviceScaleFactor: Number(args.scale ?? 2),
  });

  try {
    await page.goto(url, {waitUntil: 'networkidle'});
  } catch (e) {
    console.error(`Could not open ${url} — is the app running at ${base}? (${e.message.split('\n')[0]})`);
    process.exitCode = 1;
    throw e;
  }

  if (str(args.highlight)) {
    await page.locator(args.highlight).first().evaluate((el, color) => {
      el.style.outline = `3px solid ${color}`;
      el.style.outlineOffset = '3px';
      el.style.borderRadius = '6px';
    }, HIGHLIGHT);
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
