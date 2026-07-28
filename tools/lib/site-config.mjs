/**
 * Shared reader for site.config.ts — used by capture.mjs, record.mjs,
 * build-pdf.mjs and make-brand-assets.mjs so no tool regex-scrapes the
 * whole file on its own ("first `name:` wins" fragility).
 *
 * The config is a TypeScript module, so we can't import it from plain Node
 * scripts; instead each field is read from within its containing block
 * (product / org / deploy), with loud warnings + sensible fallbacks when a
 * field can't be parsed.
 */
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const FALLBACKS = {
  productName: 'Your Product',
  tagline: '',
  orgName: 'Your Company',
  orgUrl: 'https://example.com',
  deployUrl: 'https://docs.example.com',
  appUrl: 'http://localhost:3000',
};

/**
 * Extract the balanced `{ … }` body for a config section. Handles both an
 * inline property (`key: { … }`) and a hoisted const referenced by shorthand
 * (`const key = { … }`).
 */
function extractBlock(src, key) {
  const start = src.search(new RegExp(`(^|[\\s,{])${key}\\s*:\\s*\\{|(^|[\\s;])const\\s+${key}\\s*=\\s*\\{`));
  if (start === -1) return null;
  const open = src.indexOf('{', start + 1);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  return null;
}

const stringField = (block, key) =>
  block?.match(new RegExp(`(^|[\\s,{])${key}\\s*:\\s*'([^']*)'`))?.[2];

/**
 * Read site.config.ts and return the fields the tooling needs.
 * Missing/unparseable fields warn to stderr and fall back to placeholders.
 */
export function readSiteConfig({configPath = 'site.config.ts', quiet = false} = {}) {
  let src = '';
  try {
    src = readFileSync(resolve(configPath), 'utf8');
  } catch {
    if (!quiet) console.warn(`⚠ ${configPath} not found — using placeholder branding values.`);
  }

  const warn = (field, fallback) => {
    if (!quiet) console.warn(`⚠ Could not parse ${field} from ${configPath} — falling back to "${fallback}".`);
    return fallback;
  };

  const productBlock = extractBlock(src, 'product');
  const orgBlock = extractBlock(src, 'org');
  const deployBlock = extractBlock(src, 'deploy');

  const productName = stringField(productBlock, 'name') ?? warn('product.name', FALLBACKS.productName);
  const tagline = stringField(productBlock, 'tagline') ?? FALLBACKS.tagline;
  const orgName = stringField(orgBlock, 'name') ?? warn('org.name', FALLBACKS.orgName);
  const orgUrl = stringField(orgBlock, 'url') ?? warn('org.url', FALLBACKS.orgUrl);
  const deployUrl = stringField(deployBlock, 'url') ?? warn('deploy.url', FALLBACKS.deployUrl);
  // appUrl lives at the top level of the config object (product-app target for
  // capture/record); accept a product-scoped one too, top-level wins.
  const appUrl =
    src.match(/^\s{2}appUrl\s*:\s*'([^']*)'/m)?.[1] ??
    stringField(productBlock, 'appUrl') ??
    warn('appUrl', FALLBACKS.appUrl);

  return {
    product: {name: productName, tagline, appUrl},
    org: {name: orgName, url: orgUrl},
    deploy: {url: deployUrl},
    appUrl,
  };
}
