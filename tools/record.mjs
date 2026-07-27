#!/usr/bin/env node
/**
 * Short workflow videos for docs — Playwright records, ffmpeg converts to
 * web-ready H.264 mp4.
 *
 *   npm run record -- --flow tools/flows/example-flow.mjs --out static/video/example
 *     [--base http://localhost:3000]   overrides APP_URL (.env) / appUrl (site.config.ts)
 *     [--width 1280 --height 800]
 *     [--poster 1.5]                   poster-frame timestamp in seconds
 *
 * The flow file exports `default async (page, {baseUrl}) => { … }` and drives
 * the product like a user would (flows can read process.env.DEMO_USER/DEMO_PASS
 * from .env). Output: <out>.mp4 + <out>.jpg poster (plus .webm if ffmpeg is
 * unavailable). Flows that tour the DOCS SITE itself need --base pointing at
 * the running docs server, e.g. --base http://localhost:3300.
 */
import {chromium} from 'playwright';
import {spawnSync} from 'node:child_process';
import {copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

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

// .env (gitignored) can provide APP_URL and demo credentials for flows.
try {
  process.loadEnvFile?.(resolve('.env'));
} catch {
  /* no .env — fine */
}

const str = (v) => (typeof v === 'string' ? v : undefined);
if (!str(args.flow) || !str(args.out)) {
  console.error('Usage: npm run record -- --flow tools/flows/<name>.mjs --out static/video/<name> [--base <url>] [--poster <seconds>]');
  process.exit(1);
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

const baseUrl = str(args.base) ?? process.env.APP_URL ?? appUrlFromConfig();
const size = {width: Number(args.width ?? 1280), height: Number(args.height ?? 800)};
const outBase = args.out.replace(/\.(mp4|webm)$/i, '');
const videoDir = mkdtempSync(join(tmpdir(), 'docs-record-'));

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

const flow = (await import(pathToFileURL(resolve(args.flow)).href)).default;

const browser = await launch();
const context = await browser.newContext({viewport: size, recordVideo: {dir: videoDir, size}});
const page = await context.newPage();
const video = page.video();

let flowError = null;
try {
  await flow(page, {baseUrl});
} catch (e) {
  flowError = e;
} finally {
  await context.close(); // flushes the video file
  await browser.close();
}

if (flowError) {
  console.error(`Flow failed: ${flowError.message.split('\n')[0]}`);
  console.error(`Is the target app running at ${baseUrl}? Flows touring the docs site need --base http://localhost:3300.`);
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

const ffmpeg = spawnSync(
  'ffmpeg',
  ['-y', '-i', webmTmp, '-c:v', 'libx264', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${outBase}.mp4`],
  {stdio: 'inherit'},
);

if (ffmpeg.error || ffmpeg.status !== 0) {
  copyFileSync(webmTmp, `${outBase}.webm`);
  console.log(`ffmpeg unavailable — kept ${outBase}.webm. Convert later with:`);
  console.log(`  ffmpeg -i ${outBase}.webm -c:v libx264 -crf 23 -pix_fmt yuv420p -movflags +faststart ${outBase}.mp4`);
} else {
  console.log(`Saved ${outBase}.mp4`);
  // Poster frame for <Video poster="…">: grab a frame past the initial paint
  // so the paused player never shows a blank white frame.
  const posterAt = str(args.poster) ?? '1.5';
  const poster = spawnSync(
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
