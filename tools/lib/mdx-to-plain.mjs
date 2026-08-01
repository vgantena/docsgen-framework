/**
 * mdx-to-plain — convert one MDX docs page (string in → string out) to plain
 * markdown for KB export and AI-assistant consumption. Pure library: no CLI,
 * no file-system access, no side effects.
 *
 * Frontmatter is parsed naively on purpose (no YAML library): flat
 * `key: value` lines plus inline `[a, b]` lists only. Nested maps, block
 * lists, multi-line strings and anchors are NOT supported — the authoring
 * templates never use them.
 *
 * Body transforms are line/regex based and target the JSX components this
 * repo's docs actually use (Steps, Figure, Video, Expandable, Tabs/TabItem,
 * Badge, ApiEndpoint, Card/CardGrid, `:::` admonitions). They do not handle
 * nested same-name components. Regular markdown passes through untouched.
 */

/** TabItem `value`s kept in KB output — other languages are dropped. */
const KEPT_TAB_VALUES = new Set(['json', 'curl']);

/**
 * Attribute run inside a JSX tag. Unlike a bare `[^>]*` this tolerates ">"
 * inside quoted values (`alt="Settings > Users"`) by consuming whole quoted
 * strings before falling back to any non-quote, non-">" character.
 */
const ATTRS = '(?:"[^"]*"|\'[^\']*\'|[^>"\'])*';

/** Read a quoted JSX attribute (`name="…"` or `name='…'`) out of an attribute string. */
function getAttr(attrs, name) {
  const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`));
  return match ? (match[1] ?? match[2]) : undefined;
}

/**
 * Drop a trailing `# comment` (must be preceded by whitespace) from a
 * frontmatter line — but never truncate a `#` that sits inside a quoted value
 * (`title: "Errors # codes"` stays intact).
 */
function stripInlineComment(line) {
  // A fully quoted value keeps everything inside the quotes, even " # ".
  const quoted = line.match(/^([\w-]+:\s*)("[^"]*"|'[^']*')\s*(?:#.*)?$/);
  if (quoted) return quoted[1] + quoted[2];
  return line.replace(/\s#.*$/, '');
}

/** Parse one frontmatter scalar: `[a, b]` lists, quoted strings, numbers, booleans. */
function parseScalar(raw) {
  const value = raw.trim();
  const list = value.match(/^\[(.*)\]$/);
  if (list) {
    return list[1]
      .split(',')
      .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
      .filter((item) => item !== '');
  }
  if (/^['"].*['"]$/.test(value)) return value.slice(1, -1);
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (value === 'true' || value === 'false') return value === 'true';
  return value;
}

/** Split off a leading `--- … ---` block; returns {frontmatter, body}. */
function parseFrontmatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return {frontmatter: {}, body: source};
  const frontmatter = {};
  for (const rawLine of match[1].split('\n')) {
    const kv = stripInlineComment(rawLine).match(/^([\w-]+):\s*(.*)$/);
    if (kv) frontmatter[kv[1]] = parseScalar(kv[2]);
  }
  return {frontmatter, body: source.slice(match[0].length)};
}

/** `<Steps>…</Steps>` → drop the wrapper tags, keep the list inside untouched. */
function unwrapSteps(body) {
  return body.replace(/^[ \t]*<\/?Steps>[ \t]*\n?/gm, '');
}

/** `<Tabs>…</Tabs>` → keep only json/curl TabItems, each led by `**{label}**`. */
function transformTabs(body) {
  return body.replace(new RegExp(`<Tabs\\b${ATTRS}>([\\s\\S]*?)</Tabs>`, 'g'), (_, inner) => {
    const kept = [];
    for (const item of inner.matchAll(new RegExp(`<TabItem\\b(${ATTRS})>([\\s\\S]*?)</TabItem>`, 'g'))) {
      const [, attrs, content] = item;
      const value = getAttr(attrs, 'value');
      if (!KEPT_TAB_VALUES.has(value)) continue;
      kept.push(`**${getAttr(attrs, 'label') ?? value}**\n\n${content.trim()}`);
    }
    return kept.join('\n\n');
  });
}

/** `<Expandable title="…">…</Expandable>` → `#### {title}` plus the inner body. */
function transformExpandables(body) {
  return body.replace(
    new RegExp(`<Expandable\\b(${ATTRS})>([\\s\\S]*?)</Expandable>`, 'g'),
    (_, attrs, inner) => `#### ${getAttr(attrs, 'title') ?? ''}\n\n${inner.trim()}`,
  );
}

/** `<Figure … />` (also multi-line) → `*Image: {alt}*` (+ ` — {caption}`). */
function transformFigures(body) {
  return body.replace(new RegExp(`<Figure\\b(${ATTRS})/>`, 'g'), (_, attrs) => {
    const alt = getAttr(attrs, 'alt');
    const caption = getAttr(attrs, 'caption');
    return `${alt ? `*Image: ${alt}*` : '*Image*'}${caption ? ` — ${caption}` : ''}`;
  });
}

/** `<Video … />` → `*Video: {caption}*` (or `*Video*` when no caption). */
function transformVideos(body) {
  return body.replace(new RegExp(`<Video\\b(${ATTRS})/>`, 'g'), (_, attrs) => {
    const caption = getAttr(attrs, 'caption');
    return caption ? `*Video: ${caption}*` : '*Video*';
  });
}

/** `<Badge …>text</Badge>` → just the text. */
function transformBadges(body) {
  return body.replace(new RegExp(`<Badge\\b${ATTRS}>([\\s\\S]*?)</Badge>`, 'g'), (_, text) => text.trim());
}

/** `<ApiEndpoint method="X" path="Y">desc</ApiEndpoint>` → `` `X Y` — desc``. */
function transformApiEndpoints(body) {
  return body.replace(
    new RegExp(`<ApiEndpoint\\b(${ATTRS})>([\\s\\S]*?)</ApiEndpoint>`, 'g'),
    (_, attrs, desc) => `\`${getAttr(attrs, 'method') ?? ''} ${getAttr(attrs, 'path') ?? ''}\` — ${desc.trim()}`,
  );
}

/** `<Card…>` / `<CardGrid…>` → drop the tags, keep the inner text. */
function unwrapCards(body) {
  return body
    .replace(new RegExp(`</?CardGrid\\b${ATTRS}>`, 'g'), '')
    .replace(new RegExp(`</?Card\\b${ATTRS}>`, 'g'), '');
}

/** `:::type [title] … :::` → `**{Title}:** ` prefix on the first body line, body kept. */
function transformAdmonitions(body) {
  return body.replace(
    /^:::(note|tip|info|warning|danger)[ \t]*([^\n]*)\n([\s\S]*?)^:::[ \t]*$/gm,
    (_, type, title, inner) => {
      const heading = title.trim() || type[0].toUpperCase() + type.slice(1);
      const lines = inner.split('\n');
      const first = lines.findIndex((line) => line.trim() !== '');
      if (first === -1) return `**${heading}:**`;
      lines[first] = `**${heading}:** ${lines[first].trim()}`;
      return lines.join('\n').trim();
    },
  );
}

/** Strip import/export lines and any remaining self-closing JSX component tags. */
function stripLeftoverJsx(body) {
  return body
    .replace(/^(import|export)\s[^\n]*\n?/gm, '')
    .replace(new RegExp(`<[A-Z][\\w.]*\\b${ATTRS}/>`, 'g'), '');
}

/** Collapse 3+ consecutive newlines left behind by removed blocks. */
function tidyWhitespace(body) {
  return body.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/**
 * Convert one MDX docs page to plain markdown.
 * @param {string} source Full page source including frontmatter.
 * @returns {{frontmatter: object, markdown: string}}
 */
export function mdxToPlain(source) {
  // A UTF-8 BOM would otherwise stop the frontmatter fence from matching at ^.
  const {frontmatter, body} = parseFrontmatter(source.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n'));
  const transforms = [
    transformTabs,
    unwrapSteps,
    transformExpandables,
    transformFigures,
    transformVideos,
    transformBadges,
    transformApiEndpoints,
    unwrapCards,
    transformAdmonitions,
    stripLeftoverJsx,
    tidyWhitespace,
  ];
  return {frontmatter, markdown: transforms.reduce((text, fn) => fn(text), body)};
}
