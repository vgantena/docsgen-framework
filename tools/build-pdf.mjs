#!/usr/bin/env node
/**
 * Builds a printable PDF manual from the same Markdown chapters as the site,
 * via Pandoc with the Typst engine (both installed as single binaries).
 *
 *   npm run pdf
 *
 * Chapters and metadata come from tools/pdf-manifest.json. Framework
 * components degrade for print: Figure → image, Video → link line,
 * Expandable → bold heading, admonitions → labeled paragraphs,
 * Mermaid fences → omitted note.
 */
import {spawnSync} from 'node:child_process';
import {mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

const manifest = JSON.parse(readFileSync(resolve('tools/pdf-manifest.json'), 'utf8'));

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
      if (line.trim().startsWith(fence.marker)) {
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
const combined = chapters.join('\n\n');

const output = resolve(manifest.output ?? 'build/manual.pdf');
mkdirSync(dirname(output), {recursive: true});

const tmpMd = resolve('.docusaurus-pdf-input.md');
writeFileSync(tmpMd, combined, 'utf8');

const pandocArgs = [
  tmpMd,
  '-f', 'gfm',
  '-o', output,
  '--pdf-engine=typst',
  '--toc',
  '--toc-depth=2',
  '--metadata', `title=${manifest.title ?? 'User Manual'}`,
];
if (manifest.author) pandocArgs.push('--metadata', `author=${manifest.author}`);
if (manifest.date) pandocArgs.push('--metadata', `date=${manifest.date}`);

const result = spawnSync('pandoc', pandocArgs, {stdio: 'inherit', cwd: process.cwd()});
rmSync(tmpMd, {force: true});

if (result.error || result.status !== 0) {
  console.error('\nPDF build failed. Check that pandoc and typst are on PATH (winget install JohnMacFarlane.Pandoc Typst.Typst).');
  process.exit(1);
}
console.log(`\nSaved ${output}`);
