#!/usr/bin/env node
/**
 * One-command auth bootstrap for capture/record — signs into the product and
 * saves a Playwright storageState file, so screenshots and videos start from
 * the Dashboard and never show the login screen.
 *
 *   npm run login
 *     [--flow tools/flows/login.mjs]   app-specific login flow (default shown)
 *     [--out auth.json]                storageState output (gitignored)
 *     [--base http://localhost:3000]   overrides APP_URL (.env) / appUrl (site.config.ts)
 *
 * The login flow exports `default async (page, {baseUrl}) => { … }`, signs in
 * using process.env.DEMO_USER / DEMO_PASS (from .env — never hardcode), and
 * returns once the app shell is visible. Re-run whenever the session expires.
 */
import {chromium} from 'playwright';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readSiteConfig} from './lib/site-config.mjs';
import {parseArgs, str} from './lib/args.mjs';

const {args} = parseArgs(process.argv.slice(2));

// .env (gitignored) provides APP_URL and demo credentials.
try {
  process.loadEnvFile?.(resolve('.env'));
} catch {
  /* no .env — fine */
}

const baseUrl = str(args, 'base') ?? process.env.APP_URL ?? readSiteConfig({quiet: true}).appUrl;
const flowPath = str(args, 'flow') ?? 'tools/flows/login.mjs';
const out = str(args, 'out') ?? 'auth.json';

if (!process.env.DEMO_USER || !process.env.DEMO_PASS) {
  console.error('DEMO_USER and DEMO_PASS must be set (put them in .env — see .env.example).');
  process.exit(1);
}

const flow = (await import(pathToFileURL(resolve(flowPath)).href)).default;

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

const browser = await launch();
try {
  const page = await browser.newPage({viewport: {width: 1280, height: 800}});
  await flow(page, {baseUrl});
  await page.context().storageState({path: resolve(out)});
  console.log(`Saved ${out} — pass it as --storage-state to capture/record.`);
} catch (e) {
  console.error(`Login failed: ${e.message.split('\n')[0]}`);
  console.error(`Is the app running at ${baseUrl}, and are DEMO_USER/DEMO_PASS valid?`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
