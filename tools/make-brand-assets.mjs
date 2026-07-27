#!/usr/bin/env node
/**
 * Generates the brand raster assets from site.config.ts + static/img/logo.svg:
 *
 *   static/img/social-card.png   1200×630 share card (og:image)
 *   static/favicon.ico           multi-purpose ICO (Safari has no SVG favicons)
 *   static/img/favicon.ico       same file at the legacy path
 *
 * Run after any re-brand: npm run brand-assets
 */
import {chromium} from 'playwright';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const cfg = readFileSync(resolve('site.config.ts'), 'utf8');
const productName = cfg.match(/name:\s*'([^']+)'/)?.[1] ?? 'Your Product';
const tagline = cfg.match(/tagline:\s*'([^']+)'/)?.[1] ?? '';
const logoSvg = readFileSync(resolve('static/img/logo.svg'), 'utf8');
const tokens = readFileSync(resolve('src/css/tokens.css'), 'utf8');
const primary = tokens.match(/--doc-color-primary:\s*(#[0-9a-fA-F]{6})/)?.[1] ?? '#cc3f22';
const accent = tokens.match(/--doc-color-accent:\s*(#[0-9a-fA-F]{6})/)?.[1] ?? '#f59e0b';

const [word1, ...rest] = productName.split(' ');
const whiteLogo = logoSvg.replace(/stroke="#[0-9a-fA-F]{6}"/, 'stroke="#ffffff"');

const cardHtml = `<!doctype html><html><head><style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; display: flex; flex-direction: column;
    justify-content: center; padding: 96px;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, ${primary}, ${accent}); color: #fff; }
  .logo { width: 120px; height: 120px; margin-bottom: 48px; }
  .logo svg { width: 100%; height: 100%; }
  h1 { font-size: 88px; font-weight: 800; letter-spacing: -0.02em; }
  h1 .w2 { opacity: 0.82; }
  p { margin-top: 20px; font-size: 38px; opacity: 0.92; }
</style></head><body>
  <div class="logo">${whiteLogo}</div>
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
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
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

  // Favicon: rasterize the logo SVG at 64px on transparent background
  const fav = await browser.newPage({viewport: {width: 64, height: 64}});
  await fav.setContent(
    `<!doctype html><style>*{margin:0}svg{width:64px;height:64px;display:block}</style>${logoSvg}`,
    {waitUntil: 'networkidle'},
  );
  const png = await fav.screenshot({omitBackground: true});
  const ico = pngToIco(png, 64);
  writeFileSync(resolve('static/favicon.ico'), ico);
  writeFileSync(resolve('static/img/favicon.ico'), ico);
  console.log('Saved static/favicon.ico + static/img/favicon.ico (64px)');
} finally {
  await browser.close();
}
