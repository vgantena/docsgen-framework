#!/usr/bin/env node
/**
 * Screenshot recompressor — shrinks the docs PNGs without visible loss. The
 * capture pipeline writes full-RGBA PNGs; flat UI screenshots quantize to a
 * palette at quality 90 with no visible difference, at a fraction of the size.
 *
 *   npm run media:optimize                 every PNG under static/img/ (recursive)
 *     [--file <path>]                      a single PNG instead
 *     [--dry-run]                          report what would change, write nothing
 *
 * Safety rules — a file is overwritten ONLY when BOTH hold:
 *   1. the re-encode is more than 5% smaller (otherwise not worth the churn);
 *   2. the re-encode decodes to identical width×height (dimension mismatch
 *      aborts that file and fails the run).
 * Running it twice is a no-op: an already-quantized PNG re-encodes to about
 * the same size and falls under the 5% threshold.
 */
import {readdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {extname, join, relative, resolve} from 'node:path';
import sharp from 'sharp';
import {parseArgs, str} from './lib/args.mjs';

const USAGE = 'Usage: npm run media:optimize [-- --file static/img/<section>/<name>.png] [--dry-run]';
const IMG_ROOT = 'static/img';
const MIN_SAVING = 0.05; // overwrite only when >5% smaller

const {args} = parseArgs(process.argv.slice(2));
const dryRun = args['dry-run'] === true;

/** Recursively collect .png paths under dir (absolute paths). */
function collectPngs(dir) {
  const out = [];
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectPngs(full));
    else if (entry.isFile() && extname(entry.name).toLowerCase() === '.png') out.push(full);
  }
  return out;
}

let files;
const file = str(args, 'file');
if (args.file !== undefined && file === undefined) {
  console.error('--file needs a path value.');
  console.error(USAGE);
  process.exit(1);
}
if (file) {
  const full = resolve(file);
  try {
    statSync(full);
  } catch {
    console.error(`--file not found: ${file}`);
    process.exit(1);
  }
  if (extname(full).toLowerCase() !== '.png') {
    console.error(`--file must be a .png (got ${file}) — sharp palette quantization is PNG-only here.`);
    process.exit(1);
  }
  files = [full];
} else {
  const root = resolve(IMG_ROOT);
  try {
    files = collectPngs(root);
  } catch (e) {
    console.error(`Could not scan ${IMG_ROOT}/: ${e.message.split('\n')[0]}`);
    process.exit(1);
  }
  if (files.length === 0) {
    console.error(`No PNGs found under ${IMG_ROOT}/ — nothing to optimize.`);
    process.exit(1);
  }
}

const kb = (bytes) => (bytes / 1024).toFixed(1);
let written = 0;
let kept = 0;
let aborted = 0;
let totalBefore = 0;
let totalAfter = 0;

for (const full of files) {
  const label = relative(process.cwd(), full).replaceAll('\\', '/');
  const input = readFileSync(full);
  let output;
  let before;
  let after;
  try {
    before = await sharp(input).metadata();
    output = await sharp(input)
      .png({palette: true, quality: 90, compressionLevel: 9, adaptiveFiltering: true})
      .toBuffer();
    // Decode the re-encode and verify sharp produced the same canvas — a
    // dimension change would mean silent corruption, so that file is aborted.
    after = await sharp(output).metadata();
  } catch (e) {
    console.error(`✗ ${label} — re-encode failed: ${e.message.split('\n')[0]}`);
    aborted++;
    continue;
  }
  if (before.width !== after.width || before.height !== after.height) {
    console.error(`✗ ${label} — dimensions changed ${before.width}×${before.height} → ${after.width}×${after.height}; original left untouched`);
    aborted++;
    continue;
  }

  const saving = 1 - output.length / input.length;
  if (saving > MIN_SAVING) {
    if (!dryRun) writeFileSync(full, output);
    written++;
    totalBefore += input.length;
    totalAfter += output.length;
    console.log(`${dryRun ? 'would write' : '✓'} ${label}  ${kb(input.length)} KB → ${kb(output.length)} KB  (-${(saving * 100).toFixed(1)}%)`);
  } else {
    kept++;
    console.log(`· ${label}  ${kb(input.length)} KB — kept (re-encode saves ${(saving * 100).toFixed(1)}%, threshold is >${MIN_SAVING * 100}%)`);
  }
}

const savedKb = kb(totalBefore - totalAfter);
console.log(`\n${written} ${dryRun ? 'would be rewritten' : 'rewritten'}, ${kept} kept, ${aborted} aborted — total saved ${savedKb} KB (${kb(totalBefore)} KB → ${kb(totalAfter)} KB on rewritten files).`);
if (aborted > 0) process.exitCode = 1;
