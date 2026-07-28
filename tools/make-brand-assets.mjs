#!/usr/bin/env node
/**
 * Regenerates the brand assets from site.config.ts + src/css/tokens.css:
 *
 *   static/img/logo.svg          stroke recolored to --doc-color-primary (light)
 *   static/img/logo-dark.svg     stroke recolored to the dark-theme --doc-color-primary
 *   static/img/favicon.svg       stroke recolored to --doc-color-primary (the icon the site serves)
 *   static/favicon.ico           legacy /favicon.ico (Safari has no SVG favicons)
 *   static/img/social-card.png   1200×630 share card (og:image), two-tone wordmark
 *   static/robots.txt            Sitemap: line rewritten from deploy.url
 *
 * Run after any re-brand: npm run brand-assets
 */
import {chromium} from 'playwright';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {readSiteConfig} from './lib/site-config.mjs';

const site = readSiteConfig();
const productName = site.product.name;
const tagline = site.product.tagline;

function readOrDie(path, hint) {
  try {
    return readFileSync(resolve(path), 'utf8');
  } catch {
    console.error(`Required file missing: ${path} — ${hint}`);
    process.exit(1);
  }
}

const logoSvg = readOrDie('static/img/logo.svg', 'the brand logo SVG is the source for every asset here.');
const tokensCss = readOrDie('src/css/tokens.css', 'design tokens define the brand colors.');

/* ── Token parsing: light `:root` block + `[data-theme='dark']` block ── */

function tokenBlock(css, selectorRe) {
  const start = css.search(selectorRe);
  if (start === -1) return {};
  const open = css.indexOf('{', start);
  let depth = 0;
  let end = css.length;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) {
      end = i;
      break;
    }
  }
  const body = css.slice(open + 1, end);
  const map = {};
  for (const m of body.matchAll(/(--doc-[\w-]+)\s*:\s*([^;]+);/g)) {
    map[m[1]] = m[2].trim();
  }
  return map;
}

const lightTokens = tokenBlock(tokensCss, /:root\s*\{/);
const darkTokens = tokenBlock(tokensCss, /\[data-theme=['"]dark['"]\]\s*\{/);

/** Resolve a token value, following var(--x[, fallback]) chains within its theme. */
function resolveToken(name, theme = lightTokens, seen = new Set()) {
  if (seen.has(name)) return undefined;
  seen.add(name);
  const raw = theme[name] ?? lightTokens[name];
  if (raw === undefined) return undefined;
  const ref = raw.match(/^var\((--[\w-]+)(?:\s*,\s*([^)]+))?\)$/);
  if (ref) return resolveToken(ref[1], theme, seen) ?? ref[2]?.trim();
  return raw;
}

function tokenColor(name, theme, fallback) {
  const value = resolveToken(name, theme);
  if (value) return value;
  console.warn(`⚠ ${name} not resolvable from tokens.css — falling back to ${fallback}.`);
  return fallback;
}

const primary = tokenColor('--doc-color-primary', lightTokens, '#cc3f22');
const primaryDark = tokenColor('--doc-color-primary', darkTokens, '#ff8a70');
const accent = tokenColor('--doc-color-accent', lightTokens, '#f59e0b');
const word1Color = tokenColor('--doc-brand-word1', lightTokens, '#1e293b');
const word2Color = tokenColor('--doc-brand-word2', lightTokens, primary);
const textMuted = tokenColor('--doc-color-text-muted', lightTokens, '#64748b');

/* ── SVGs: recolor strokes from the current tokens ──────────────────── */

const recolor = (svg, color) => svg.replace(/stroke="#[0-9a-fA-F]{3,8}"/g, `stroke="${color}"`);

const logoLight = recolor(logoSvg, primary);
writeFileSync(resolve('static/img/logo.svg'), logoLight);
console.log(`Saved static/img/logo.svg (stroke ${primary})`);

// Dark-theme logo: rewrite if present, otherwise derive it from logo.svg.
const logoDarkPath = resolve('static/img/logo-dark.svg');
const logoDarkSource = existsSync(logoDarkPath) ? readFileSync(logoDarkPath, 'utf8') : logoSvg;
writeFileSync(logoDarkPath, recolor(logoDarkSource, primaryDark));
console.log(`Saved static/img/logo-dark.svg (stroke ${primaryDark})`);

// The favicon the site actually serves (site.config.ts → product.favicon).
const faviconSvgPath = resolve('static/img/favicon.svg');
const faviconSource = existsSync(faviconSvgPath) ? readFileSync(faviconSvgPath, 'utf8') : logoSvg;
const faviconSvg = recolor(faviconSource, primary);
writeFileSync(faviconSvgPath, faviconSvg);
console.log(`Saved static/img/favicon.svg (stroke ${primary})`);

/* ── Social card: same two-tone wordmark treatment as the navbar ────── */

const [word1, ...rest] = productName.split(' ');

const cardHtml = `<!doctype html><html><head><style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; display: flex; flex-direction: column;
    justify-content: center; padding: 96px; position: relative;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    background: #ffffff; color: ${word1Color}; }
  body::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0;
    height: 18px; background: linear-gradient(90deg, ${primary}, ${accent}); }
  .logo { width: 120px; height: 120px; margin-bottom: 48px; }
  .logo svg { width: 100%; height: 100%; }
  h1 { font-size: 88px; font-weight: 800; letter-spacing: -0.02em; color: ${word1Color}; }
  h1 .w2 { color: ${word2Color}; }
  p { margin-top: 20px; font-size: 38px; color: ${textMuted}; }
</style></head><body>
  <div class="logo">${logoLight}</div>
  <h1>${word1}${rest.length ? `<span class="w2">${rest.join(' ')}</span>` : ''}</h1>
  ${tagline ? `<p>${tagline}</p>` : ''}
</body></html>`;

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

/** Wrap a PNG buffer in a single-image ICO container (PNG-in-ICO, IE11+/all modern). */
function pngToIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size, 0); // width (icons here are always < 256)
  entry.writeUInt8(size, 1); // height
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12); // data offset: 6 + 16
  return Buffer.concat([header, entry, png]);
}

const browser = await launch();
try {
  // Social card
  const card = await browser.newPage({viewport: {width: 1200, height: 630}});
  await card.setContent(cardHtml, {waitUntil: 'networkidle'});
  await card.screenshot({path: resolve('static/img/social-card.png')});
  console.log('Saved static/img/social-card.png (1200×630)');

  // Legacy ICO for /favicon.ico requests: rasterize the favicon SVG at 64px.
  const fav = await browser.newPage({viewport: {width: 64, height: 64}});
  await fav.setContent(
    `<!doctype html><style>*{margin:0}svg{width:64px;height:64px;display:block}</style>${faviconSvg}`,
    {waitUntil: 'networkidle'},
  );
  const png = await fav.screenshot({omitBackground: true});
  writeFileSync(resolve('static/favicon.ico'), pngToIco(png, 64));
  console.log('Saved static/favicon.ico (64px)');
} finally {
  await browser.close();
}

/* ── robots.txt: keep the Sitemap host in sync with deploy.url ──────── */

const robotsPath = resolve('static/robots.txt');
if (existsSync(robotsPath)) {
  const deployUrl = site.deploy.url.replace(/\/+$/, '');
  if (/example\.com/.test(deployUrl)) {
    console.warn(`⚠ deploy.url is still the placeholder (${deployUrl}) — static/robots.txt Sitemap line left unchanged. Set deploy.url in site.config.ts and rerun.`);
  } else {
    const robots = readFileSync(robotsPath, 'utf8');
    const updated = robots.replace(/^Sitemap:\s*\S+$/m, `Sitemap: ${deployUrl}/sitemap.xml`);
    if (updated !== robots) {
      writeFileSync(robotsPath, updated);
      console.log(`Saved static/robots.txt (Sitemap: ${deployUrl}/sitemap.xml)`);
    }
  }
}
