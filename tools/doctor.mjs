#!/usr/bin/env node
/**
 * Setup validator — run this FIRST after cloning (and any time something
 * misbehaves). Checks every prerequisite and configuration surface the
 * framework depends on and says exactly what to fix and how.
 *
 *   npm run doctor
 *
 * Exit code: 1 only on hard failures (wrong Node, missing dependencies);
 * warnings (optional tooling, pending rebrand) exit 0 so CI setup steps can
 * gate on real breakage only.
 */
import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {run} from './lib/spawn.mjs';
import {readSiteConfig} from './lib/site-config.mjs';

try {
  process.loadEnvFile?.(resolve('.env'));
} catch {
  /* no .env — reported below */
}

const results = [];
const ok = (name, detail = '') => results.push({level: 'ok', name, detail});
const warn = (name, detail) => results.push({level: 'warn', name, detail});
const fail = (name, detail) => results.push({level: 'fail', name, detail});

function binVersion(cmd, args = ['--version']) {
  const r = run(cmd, args, {encoding: 'utf8'});
  if (r.error || r.status !== 0) return null;
  return String(r.stdout || r.stderr || '').split('\n')[0].trim();
}

// ── Hard requirements ──
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor >= 22) ok('Node.js', `v${process.versions.node}`);
else fail('Node.js', `v${process.versions.node} — needs >= 22 (see package.json engines)`);

if (existsSync(resolve('node_modules/@docusaurus/core'))) ok('Dependencies', 'node_modules present');
else fail('Dependencies', 'run: npm install');

// ── Browsers (capture/record use installed Chrome/Edge, else bundled Chromium) ──
const chromePaths = [
  process.env['ProgramFiles'] && `${process.env['ProgramFiles']}\\Google\\Chrome\\Application\\chrome.exe`,
  process.env['ProgramFiles(x86)'] && `${process.env['ProgramFiles(x86)']}\\Google\\Chrome\\Application\\chrome.exe`,
  process.env['ProgramFiles'] && `${process.env['ProgramFiles']}\\Microsoft\\Edge\\Application\\msedge.exe`,
  process.env['ProgramFiles(x86)'] && `${process.env['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
  '/Applications/Google Chrome.app',
  '/usr/bin/google-chrome',
  '/usr/bin/microsoft-edge',
].filter(Boolean);
if (process.platform === 'win32' || process.platform === 'darwin' || process.platform === 'linux') {
  if (chromePaths.some((p) => existsSync(p))) ok('Browser', 'Chrome or Edge found (screenshots/videos)');
  else warn('Browser', 'no Chrome/Edge found — run: npx playwright install chromium');
}

// ── Optional tooling per feature ──
const ffmpeg = binVersion('ffmpeg', ['-version']);
if (ffmpeg) ok('ffmpeg', ffmpeg.slice(0, 40));
else warn('ffmpeg', 'videos (npm run record) need it — winget install Gyan.FFmpeg / brew install ffmpeg, then open a NEW shell');

const pandoc = binVersion('pandoc');
if (pandoc) ok('pandoc', pandoc.slice(0, 40));
else warn('pandoc', 'PDF manual (npm run pdf) needs it — winget install JohnMacFarlane.Pandoc');

const typst = binVersion('typst');
if (typst) ok('typst', typst.slice(0, 40));
else warn('typst', 'PDF manual (npm run pdf) needs it — winget install Typst.Typst');

const vale = binVersion('vale');
if (vale) ok('Vale', vale.slice(0, 40));
else warn('Vale', 'prose gate (npm run lint:prose) needs it — winget install errata-ai.Vale, then: vale sync');

// ── Configuration surfaces ──
const site = readSiteConfig({quiet: true});
const productName = site.product?.name;
if (!productName || productName === 'Your Product') {
  warn('Branding', 'site.config.ts still has placeholder values — set product/org/URLs (see README "Make it yours")');
} else {
  ok('Branding', `product "${productName}" by ${site.org?.name ?? '?'}, app ${site.appUrl}`);
}

if (existsSync(resolve('.env'))) {
  const missing = ['DEMO_USER', 'DEMO_PASS'].filter((k) => !process.env[k]);
  if (missing.length === 0) ok('.env', 'demo credentials set (login/record flows)');
  else warn('.env', `${missing.join(', ')} not set — npm run login and video flows need them (see .env.example)`);
} else {
  warn('.env', 'missing — copy .env.example to .env and fill APP_URL + DEMO_USER/DEMO_PASS');
}

let docgenConfig = null;
try {
  docgenConfig = JSON.parse(readFileSync(resolve('docgen.config.json'), 'utf8'));
  ok('docgen.config.json', `${(docgenConfig.sources ?? []).length} source(s), templateVersion ${docgenConfig.templateVersion}`);
} catch {
  fail('docgen.config.json', 'missing or invalid JSON — the committed pipeline definition is required');
}
if (docgenConfig) {
  const kb = docgenConfig.kb;
  if (kb && Array.isArray(kb.components) && kb.components.length > 0) {
    ok('KB export config', `${kb.components.length} components, API base ${kb.apiBasePath ?? '/api/platform'}`);
    if (!process.env.KB_USER || !process.env.KB_PASS) {
      warn('KB credentials', 'KB_USER/KB_PASS not in .env — docgen:kb-export --write will refuse (dry-run works)');
    } else {
      ok('KB credentials', 'set');
    }
  } else {
    warn('KB export config', 'no "kb" section in docgen.config.json — docgen:kb-export is disabled until the product vocabulary is configured');
  }
}

if (existsSync(resolve('auth.json'))) ok('auth.json', 'present (authenticated capture/record ready)');
else warn('auth.json', 'not created yet — run: npm run login (after .env is filled)');

// ── Target app reachability ──
const appUrl = process.env.APP_URL ?? site.appUrl;
// Exact match against the shipped default only — heuristics like /localhost:3000$/
// false-positive on real apps such as http://app.localhost:3000.
const isDefaultAppUrl = typeof appUrl === 'string' && appUrl.replace(/\/$/, '') === 'http://localhost:3000';
if (appUrl && !isDefaultAppUrl) {
  let parsed = null;
  try {
    parsed = new URL(appUrl);
  } catch {
    warn('App reachable', `APP_URL is not a valid URL: ${appUrl}`);
  }
  if (parsed) {
    const probe = async (url) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      try {
        return await fetch(url, {signal: controller.signal});
      } finally {
        clearTimeout(timer);
      }
    };
    try {
      const res = await probe(appUrl);
      ok('App reachable', `${appUrl} → HTTP ${res.status}`);
    } catch {
      // Some resolvers refuse *.localhost names that browsers resolve natively —
      // fall back to loopback on the same port before declaring the app down.
      if (parsed.hostname.endsWith('.localhost')) {
        try {
          const port = parsed.port || (parsed.protocol === 'https:' ? 443 : 80);
          const res = await probe(`${parsed.protocol}//127.0.0.1:${port}${parsed.pathname}`);
          ok('App reachable', `${appUrl} via 127.0.0.1 → HTTP ${res.status} (this shell cannot resolve *.localhost; browsers can)`);
        } catch {
          warn('App reachable', `${appUrl} did not respond — start the product app before capture/record`);
        }
      } else {
        warn('App reachable', `${appUrl} did not respond — start the product app before capture/record`);
      }
    }
  }
} else {
  warn('App reachable', 'APP_URL/appUrl still default — point it at the running product app');
}

// ── Report ──
const icon = {ok: '✓', warn: '⚠', fail: '✗'};
console.log('\nDocs framework doctor\n');
for (const r of results) {
  console.log(` ${icon[r.level]} ${r.name.padEnd(20)} ${r.detail}`);
}
const fails = results.filter((r) => r.level === 'fail').length;
const warns = results.filter((r) => r.level === 'warn').length;
console.log(`\n${results.length - fails - warns} ok, ${warns} warning(s), ${fails} failure(s).`);
if (fails > 0) {
  console.log('Fix the ✗ items before using the framework.');
  process.exitCode = 1;
} else if (warns > 0) {
  console.log('Warnings limit specific features only — details above.');
}
