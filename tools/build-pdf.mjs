#!/usr/bin/env node
/**
 * Builds a printable PDF manual from the same Markdown chapters as the site,
 * via Pandoc with the Typst engine (both installed as single binaries).
 *
 *   npm run pdf
 *
 * Chapters come from tools/pdf-manifest.json; title/author default to the
 * product/org names in site.config.ts (manifest "title"/"author" fields are
 * optional overrides). Framework components degrade for print: Figure →
 * image, Video → link line, Expandable → bold heading, admonitions →
 * labeled paragraphs, Mermaid fences → omitted note, Cards → bullets,
 * internal links → plain text.
 */
import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {readSiteConfig} from './lib/site-config.mjs';
import {run} from './lib/spawn.mjs';

const manifest = JSON.parse(readFileSync(resolve('tools/pdf-manifest.json'), 'utf8'));
const site = readSiteConfig();

/* ── Preflight: pandoc >= 3 (typst engine), all chapters present ────── */

const versionProbe = run('pandoc', ['--version'], {encoding: 'utf8'});
if (versionProbe.error || versionProbe.status !== 0) {
  console.error('pandoc not found on PATH — install it (winget install JohnMacFarlane.Pandoc / brew install pandoc) and retry.');
  process.exit(1);
}
const pandocVersion = versionProbe.stdout.match(/^pandoc(?:\.exe)?\s+(\d+)\.(\d+)/)?.slice(1).map(Number);
if (!pandocVersion || pandocVersion[0] < 3) {
  console.error(`pandoc >= 3.0 is required for the typst PDF engine — found ${pandocVersion ? pandocVersion.join('.') : 'an unrecognized version'}.`);
  console.error('Upgrade: winget upgrade JohnMacFarlane.Pandoc / brew upgrade pandoc.');
  process.exit(1);
}

const missing = manifest.chapters.filter((file) => !existsSync(resolve(file)));
if (missing.length) {
  console.error('tools/pdf-manifest.json lists chapters that do not exist (renamed or removed?):');
  for (const file of missing) console.error(`  - ${file}`);
  console.error('Fix the stale entries in tools/pdf-manifest.json.');
  process.exit(1);
}

/** Component degradations for print — applied ONLY to prose (never inside code fences). */
function transformProse(md) {
  // <ApiEndpoint method path>desc</ApiEndpoint> → **METHOD** `path` — desc
  md = md.replace(/<ApiEndpoint\s+([^>]*?)\/>/g, (_, attrs) => apiEndpointLine(attrs, ''));
  md = md.replace(/<ApiEndpoint\s+([^>]*)>([\s\S]*?)<\/ApiEndpoint>/g, (_, attrs, desc) =>
    apiEndpointLine(attrs, desc),
  );

  // <Tabs> vanish; each <TabItem label="X"> becomes a bold lead-in.
  md = md.replace(/<\/?Tabs[^>]*>/g, '');
  md = md.replace(/<TabItem[^>]*label="([^"]+)"[^>]*>/g, '**$1:**');
  md = md.replace(/<\/TabItem>/g, '');

  // <Figure src alt caption? …/> → standard image + caption, preserving list indentation.
  md = md.replace(/^([ \t]*)<Figure\s+([\s\S]*?)\/>/gm, (_, indent, attrs) => {
    const src = attrs.match(/src="([^"]+)"/)?.[1] ?? '';
    const alt = attrs.match(/alt="([^"]+)"/)?.[1] ?? '';
    const caption = attrs.match(/caption="([^"]+)"/)?.[1];
    const path = src.startsWith('/') ? `static${src}` : src;
    const image = `${indent}![${alt}](${path})`;
    return caption ? `${image}\n\n${indent}*${caption}*` : image;
  });

  // <Video src …/> → reference line
  md = md.replace(/<Video\s+([\s\S]*?)\/>/g, (_, attrs) => {
    const src = attrs.match(/src="([^"]+)"/)?.[1] ?? '';
    return `*Video available in the online help center: \`${src}\`*`;
  });

  // <Steps> wrappers vanish; the ordered list prints normally.
  md = md.replace(/<\/?Steps>/g, '');

  // <Expandable title="…"> → bold lead-in
  md = md.replace(/<Expandable\s+title="([^"]+)"[^>]*>/g, '**$1**\n');
  md = md.replace(/<\/Expandable>/g, '');

  // <Badge variant="…">text</Badge> → [TEXT]
  md = md.replace(/<Badge[^>]*>([\s\S]*?)<\/Badge>/g, '**[$1]**');

  // Cards: keep title + body as a list item.
  md = md.replace(/<Card\s+[^>]*title="([^"]+)"[^>]*>([\s\S]*?)<\/Card>/g, (_, t, body) => `- **${t}** — ${body.trim()}`);
  md = md.replace(/<Card\s+[^>]*title="([^"]+)"[^>]*\/>/g, '- **$1**');
  md = md.replace(/<\/?CardGrid[^>]*>/g, '');

  // <kbd>X</kbd> → `X`
  md = md.replace(/<kbd>([\s\S]*?)<\/kbd>/g, '`$1`');

  // MDX-isms that would print literally: comments and top-level import/export.
  md = md.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  md = md.replace(/^(import|export)\s.*$/gm, '');

  // Root-relative image paths → the static/ filesystem path pandoc can read.
  md = md.replace(/(!\[[^\]]*\]\()\/(?=[^)\s])/g, '$1static/');

  // Internal root-relative links (incl. anchors) would be dead in a PDF —
  // keep just the link text. External http(s) links stay links.
  md = md.replace(/(?<!!)\[([^\]]+)\]\(\/[^)]*\)/g, '$1');

  // Admonitions → labeled paragraphs.
  md = md.replace(/^:::(tip|note|info|warning|danger|caution)(?:\[[^\]]*\])?\s*$/gm, (_, kind) => {
    const label = {tip: 'Tip', note: 'Note', info: 'Note', warning: 'Warning', danger: 'Warning', caution: 'Caution'}[kind];
    return `**${label}:**`;
  });
  md = md.replace(/^:::\s*$/gm, '');

  return md;
}

function apiEndpointLine(attrs, desc) {
  const method = attrs.match(/method="([^"]+)"/)?.[1] ?? '';
  const path = attrs.match(/path="([^"]+)"/)?.[1] ?? '';
  const text = desc.replace(/\s+/g, ' ').trim();
  return `**${method}** \`${path}\`${text ? ` — ${text}` : ''}`;
}

function transform(markdown) {
  let md = markdown;

  // Strip frontmatter, keep its title as the chapter H1 if the body has none.
  let fmTitle = null;
  md = md.replace(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/, (_, fm) => {
    const m = fm.match(/^title:\s*(.+)$/m);
    if (m) fmTitle = m[1].trim().replace(/^['"]|['"]$/g, '');
    return '';
  });
  if (fmTitle && !/^#\s/m.test(md)) {
    md = `# ${fmTitle}\n\n${md}`;
  }

  // Walk fenced code blocks so component regexes never rewrite code samples.
  // Mermaid fences are replaced with a note; all other fences pass untouched.
  const lines = md.split('\n');
  const out = [];
  let prose = [];
  let fence = null; // {marker, lang, lines}
  const flushProse = () => {
    if (prose.length) out.push(transformProse(prose.join('\n')));
    prose = [];
  };
  for (const line of lines) {
    const open = line.match(/^([ \t]*)(`{3,}|~{3,})(.*)$/);
    if (!fence && open) {
      flushProse();
      fence = {marker: open[2], lang: open[3].trim(), lines: [line]};
    } else if (fence) {
      fence.lines.push(line);
      // CommonMark closing fence: same character, length >= the opening
      // fence, nothing but whitespace after it — a longer inner fence
      // (e.g. ```` inside ```) must NOT terminate the block early.
      const close = line.match(/^[ \t]*(`{3,}|~{3,})[ \t]*$/);
      if (close && close[1][0] === fence.marker[0] && close[1].length >= fence.marker.length) {
        if (fence.lang.startsWith('mermaid')) {
          out.push('*(Diagram available in the online help center.)*');
        } else {
          out.push(fence.lines.join('\n'));
        }
        fence = null;
      }
    } else {
      prose.push(line);
    }
  }
  if (fence) out.push(fence.lines.join('\n')); // unclosed fence: keep as-is
  flushProse();

  return out.join('\n').trim();
}

const chapters = manifest.chapters.map((file) => transform(readFileSync(resolve(file), 'utf8')));
// Raw typst page break between chapters (needs -f gfm+raw_attribute).
const combined = chapters.join('\n\n```{=typst}\n#pagebreak()\n```\n\n');

const output = resolve(manifest.output ?? 'build/manual.pdf');
mkdirSync(dirname(output), {recursive: true});

const tmpMd = resolve('.docusaurus-pdf-input.md');
writeFileSync(tmpMd, combined, 'utf8');

// Branding comes from site.config.ts; manifest fields are optional overrides.
const title = manifest.title ?? `${site.product.name} User Manual`;
const author = manifest.author ?? site.org.name;

const pandocArgs = [
  tmpMd,
  '-f', 'gfm+raw_attribute',
  '-o', output,
  '--pdf-engine=typst',
  '--toc',
  '--toc-depth=2',
  '--metadata', `title=${title}`,
  '--metadata', `author=${author}`,
];
if (manifest.date) pandocArgs.push('--metadata', `date=${manifest.date}`);

const result = run('pandoc', pandocArgs, {stdio: 'inherit', cwd: process.cwd()});
rmSync(tmpMd, {force: true});

if (result.error || result.status !== 0) {
  console.error('\nPDF build failed. Check that pandoc and typst are on PATH (winget install JohnMacFarlane.Pandoc Typst.Typst).');
  process.exit(1);
}
console.log(`\nSaved ${output}`);
