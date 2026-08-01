#!/usr/bin/env node
/**
 * Short workflow videos for docs — Playwright records, ffmpeg converts to
 * web-ready H.264 mp4.
 *
 *   npm run record -- --flow tools/flows/example-flow.mjs --out static/video/example
 *     [--base http://localhost:3000]   overrides APP_URL (.env) / appUrl (site.config.ts)
 *     [--width 1280 --height 800]
 *     [--poster 1.5]                   poster-frame timestamp in seconds
 *     [--storage-state auth.json]      start signed in (create with: npm run login) —
 *                                      training videos must never show the login screen
 *
 * The flow file exports `default async (page, {baseUrl, ui}) => { … }` and drives
 * the product like a user would (flows can read process.env.DEMO_USER/DEMO_PASS
 * from .env). Every real click automatically renders a visible pulse ring in the
 * recording. The `ui` helper makes training-quality footage: `await ui.click(sel)`
 * outlines the element, pauses so the viewer can find it, then clicks;
 * `await ui.fill(sel, value)` outlines the field in yellow while filling. Colors
 * come from the --doc-frame-highlight* tokens.
 * Output: <out>.mp4 + <out>.jpg poster — ffmpeg is required; if it is missing the
 * run fails (the raw .webm is kept, gitignored, for a rerun). Flows that tour the
 * DOCS SITE itself need --base pointing at the running docs server,
 * e.g. --base http://localhost:3300.
 */
import {chromium} from 'playwright';
import {copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readSiteConfig} from './lib/site-config.mjs';
import {run} from './lib/spawn.mjs';
import {parseArgs, str, num} from './lib/args.mjs';

const {args} = parseArgs(process.argv.slice(2));

// .env (gitignored) can provide APP_URL and demo credentials for flows.
try {
  process.loadEnvFile?.(resolve('.env'));
} catch {
  /* no .env — fine */
}

if (!str(args, 'flow') || !str(args, 'out')) {
  console.error('Usage: npm run record -- --flow tools/flows/<name>.mjs --out static/video/<name> [--base <url>] [--poster <seconds>]');
  process.exit(1);
}

const baseUrl = str(args, 'base') ?? process.env.APP_URL ?? readSiteConfig({quiet: true}).appUrl;
const size = {width: num(args, 'width', 1280), height: num(args, 'height', 800)};
const outBase = str(args, 'out').replace(/\.(mp4|webm)$/i, '');
const videoDir = mkdtempSync(join(tmpdir(), 'docs-record-'));

const storageStatePath = str(args, 'storage-state');
if (storageStatePath && !existsSync(resolve(storageStatePath))) {
  console.error(`--storage-state file not found: ${storageStatePath}`);
  console.error('Create one with: npm run login (reads APP_URL + DEMO_USER/DEMO_PASS from .env).');
  process.exit(1);
}

/** Highlight colors from the design tokens (same source capture.mjs uses). */
function highlightColor(name) {
  const fallback = name === 'yellow' ? '#f7b500' : name === 'action' ? '#2f6fed' : '#e5484d';
  const token = name ? `--doc-frame-highlight-${name}` : '--doc-frame-highlight';
  try {
    const tokens = readFileSync(resolve('src/css/tokens.css'), 'utf8');
    const m = tokens.match(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{3,8}|[a-z][a-z-]*\\([^)]*\\))`));
    if (m) return m[1];
  } catch {
    /* fall through */
  }
  return fallback;
}

/**
 * Injected before any page script: every real pointerdown renders an expanding
 * pulse ring at the click point so viewers can follow the mouse in recordings.
 */
function clickPulseScript(color) {
  return `addEventListener('pointerdown', (e) => {
    const ring = document.createElement('div');
    ring.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;' +
      'width:14px;height:14px;border-radius:50%;border:3px solid ${color};' +
      'left:' + (e.clientX - 7) + 'px;top:' + (e.clientY - 7) + 'px;';
    document.body.appendChild(ring);
    ring.animate(
      [{transform: 'scale(1)', opacity: 0.9}, {transform: 'scale(3.4)', opacity: 0}],
      {duration: 550, easing: 'ease-out'},
    ).onfinish = () => ring.remove();
  }, {capture: true});`;
}

/**
 * Resolve ONE ElementHandle for the selector and outline it via inline style;
 * returns {handle, undo}. Everything (outline, act, undo) uses the same handle
 * so the three steps can never resolve to different elements, and undo on a
 * node the click detached throws immediately (swallowed) instead of silently
 * waiting the full locator timeout mid-video.
 */
async function outline(page, selector, color) {
  const handle = await page.locator(selector).first().elementHandle();
  await handle.evaluate((node, outlineColor) => {
    node.dataset.docsPrevOutline = node.style.outline || '';
    node.style.outline = `3px solid ${outlineColor}`;
    node.style.outlineOffset = '2px';
    node.style.borderRadius = node.style.borderRadius || '6px';
  }, color);
  const undo = () =>
    handle
      .evaluate((node) => {
        node.style.outline = node.dataset.docsPrevOutline || '';
        delete node.dataset.docsPrevOutline;
      })
      .catch(() => {});
  return {handle, undo};
}

/** Training-footage helpers handed to flows as the `ui` option. */
function makeUi(page) {
  const actionColor = highlightColor('action');
  const fillColor = highlightColor('yellow');
  return {
    /** Outline the target, pause so the viewer can find it, then click. */
    async click(selector, {color = actionColor, dwell = 900, settle = 900} = {}) {
      const {handle, undo} = await outline(page, selector, color);
      await page.waitForTimeout(dwell);
      await handle.click();
      await undo();
      await page.waitForTimeout(settle);
    },
    /** Outline the field in yellow while its value is filled in. */
    async fill(selector, value, {dwell = 600, settle = 700} = {}) {
      const {handle, undo} = await outline(page, selector, fillColor);
      await page.waitForTimeout(dwell);
      await handle.fill(value);
      await page.waitForTimeout(settle);
      await undo();
    },
    /** Draw attention to an element without interacting (for example a badge). */
    async spotlight(selector, {color = highlightColor(), hold = 1400} = {}) {
      const {undo} = await outline(page, selector, color);
      await page.waitForTimeout(hold);
      await undo();
    },
  };
}

async function launch() {
  for (const channel of ['chrome', 'msedge']) {
    try {
      return await chromium.launch({channel});
    } catch {
      /* try next */
    }
  }
  return chromium.launch();
}

const flow = (await import(pathToFileURL(resolve(str(args, 'flow'))).href)).default;

const browser = await launch();
const context = await browser.newContext({
  viewport: size,
  recordVideo: {dir: videoDir, size},
  ...(storageStatePath ? {storageState: resolve(storageStatePath)} : {}),
});
await context.addInitScript(clickPulseScript(highlightColor('action')));
const page = await context.newPage();
const video = page.video();

let flowError = null;
try {
  await flow(page, {baseUrl, ui: makeUi(page)});
} catch (e) {
  flowError = e;
} finally {
  await context.close(); // flushes the video file
  await browser.close();
}

if (flowError) {
  console.error(`Flow failed: ${flowError.message.split('\n')[0]}`);
  console.error(`Is the target app running at ${baseUrl}? Flows touring the docs site need --base http://localhost:3300.${storageStatePath ? ' …or is the storage state stale? re-run: npm run login' : ''}`);
  rmSync(videoDir, {recursive: true, force: true});
  process.exit(1);
}

const webmTmp = video ? await video.path() : null;

if (!webmTmp) {
  console.error('No video was produced.');
  rmSync(videoDir, {recursive: true, force: true});
  process.exit(1);
}

mkdirSync(dirname(resolve(`${outBase}.mp4`)), {recursive: true});

const ffmpeg = run(
  'ffmpeg',
  ['-y', '-i', webmTmp, '-c:v', 'libx264', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${outBase}.mp4`],
  {stdio: 'inherit'},
);

if (ffmpeg.error || ffmpeg.status !== 0) {
  copyFileSync(webmTmp, `${outBase}.webm`);
  console.error(`ffmpeg failed or is not installed — every documented embed needs ${outBase}.mp4 + ${outBase}.jpg poster.`);
  console.error('Install it:  Windows: winget install Gyan.FFmpeg   macOS: brew install ffmpeg   Linux: apt install ffmpeg');
  console.error('(New shell after winget install? Refresh PATH first — see "Environment notes" in CLAUDE.md.)');
  console.error(`The raw recording was kept at ${outBase}.webm (gitignored); rerun this command once ffmpeg works.`);
  rmSync(videoDir, {recursive: true, force: true});
  process.exit(1);
} else {
  console.log(`Saved ${outBase}.mp4`);
  // Poster frame for <Video poster="…">: grab a frame past the initial paint
  // so the paused player never shows a blank white frame.
  const posterAt = str(args, 'poster') ?? '1.5';
  const poster = run(
    'ffmpeg',
    ['-y', '-ss', String(posterAt), '-i', `${outBase}.mp4`, '-frames:v', '1', '-q:v', '3', `${outBase}.jpg`],
    {stdio: 'ignore'},
  );
  if (!poster.error && poster.status === 0) {
    console.log(`Saved ${outBase}.jpg (poster, frame at ${posterAt}s — override with --poster <seconds>)`);
  } else {
    console.warn(`Poster frame failed (clip shorter than ${posterAt}s?) — retry with --poster 0`);
  }
}

rmSync(videoDir, {recursive: true, force: true});
