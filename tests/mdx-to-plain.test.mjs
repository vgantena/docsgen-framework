import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mdxToPlain} from '../tools/lib/mdx-to-plain.mjs';

/**
 * Unit tests for tools/lib/mdx-to-plain.mjs — one realistic composite page
 * exercising every component pattern the repo's docs use, converted once and
 * asserted per feature.
 */
const FIXTURE = `---
title: Create an item
description: Add a product to your catalog.
sidebar_position: 2
category: Projects          # KB component this page belongs to
keywords: [item, product, sku, add item]
audience: vendor
---

import Thing from '@site/src/components/Thing';

# Create an item

<Badge variant="info">Admin role</Badge>

<ApiEndpoint method="POST" path="/v1/items">Creates one item.</ApiEndpoint>

<Steps>

1. Select **Items**.

2. Select **New item**.

   <Figure
     src="/img/items/create-item.png"
     alt="The new item form"
     caption="The item form with required fields."
     frame="browser"
   />

3. Select **Save**.

</Steps>

<Video src="/video/items/create-item.mp4" poster="/video/items/create-item.jpg" caption="Creating an item end to end" />

:::warning
Deleting an item cannot be undone.
:::

:::note Heads up
Items sync to the POS overnight.
:::

<Expandable title="Item does not appear in POS">

Sync runs overnight. Force it from **Settings**.

</Expandable>

<Tabs groupId="lang">
<TabItem value="json" label="JSON">

\`\`\`json
{"name": "Coffee"}
\`\`\`

</TabItem>
<TabItem value="curl" label="curl">

\`\`\`bash
curl -X POST /v1/items
\`\`\`

</TabItem>
<TabItem value="java" label="Java">
java sample body
</TabItem>
<TabItem value="python" label="Python">
python sample body
</TabItem>
<TabItem value="js" label="JavaScript">
js sample body
</TabItem>
</Tabs>

<CardGrid>
<Card title="Items guide" icon="box">
See the items guide.
</Card>
</CardGrid>
`;

const {frontmatter, markdown} = mdxToPlain(FIXTURE);

test('frontmatter: scalars parse and inline comments are stripped', () => {
  assert.equal(frontmatter.title, 'Create an item');
  assert.equal(frontmatter.description, 'Add a product to your catalog.');
  assert.equal(frontmatter.sidebar_position, 2);
  assert.equal(frontmatter.category, 'Projects');
  assert.equal(frontmatter.audience, 'vendor');
});

test('frontmatter: keywords inline list becomes an array', () => {
  assert.deepEqual(frontmatter.keywords, ['item', 'product', 'sku', 'add item']);
});

test('a page without frontmatter yields an empty object and the full body', () => {
  const result = mdxToPlain('# Plain page\n\nBody text.\n');
  assert.deepEqual(result.frontmatter, {});
  assert.match(result.markdown, /# Plain page/);
  assert.match(result.markdown, /Body text\./);
});

test('Steps wrapper is dropped, numbered list survives untouched', () => {
  assert.ok(!markdown.includes('<Steps>'));
  assert.ok(!markdown.includes('</Steps>'));
  assert.match(markdown, /1\. Select \*\*Items\*\*\./);
  assert.match(markdown, /3\. Select \*\*Save\*\*\./);
});

test('multi-line Figure becomes a single image line with alt and caption', () => {
  assert.match(markdown, /\*Image: The new item form\* — The item form with required fields\./);
  assert.ok(!markdown.includes('<Figure'));
});

test('Video becomes a caption line', () => {
  assert.match(markdown, /\*Video: Creating an item end to end\*/);
  assert.equal(mdxToPlain('<Video src="/v.mp4" />\n').markdown.trim(), '*Video*');
});

test('Expandable becomes an h4 heading followed by its body', () => {
  assert.match(markdown, /#### Item does not appear in POS\n\nSync runs overnight\./);
});

test('Tabs keep only json and curl, each preceded by its bold label', () => {
  assert.match(markdown, /\*\*JSON\*\*\n\n```json/);
  assert.match(markdown, /\*\*curl\*\*\n\n```bash/);
  assert.ok(markdown.includes('{"name": "Coffee"}'));
  assert.ok(markdown.includes('curl -X POST /v1/items'));
});

test('Tabs drop python, java and js entirely', () => {
  assert.ok(!markdown.includes('python sample body'));
  assert.ok(!markdown.includes('java sample body'));
  assert.ok(!markdown.includes('js sample body'));
  assert.ok(!markdown.includes('<TabItem'));
});

test('admonition without a title gets its capitalized type as prefix', () => {
  assert.match(markdown, /\*\*Warning:\*\* Deleting an item cannot be undone\./);
});

test('admonition with a custom title uses that title', () => {
  assert.match(markdown, /\*\*Heads up:\*\* Items sync to the POS overnight\./);
});

test('Badge collapses to its inner text', () => {
  assert.ok(markdown.includes('Admin role'));
  assert.ok(!markdown.includes('<Badge'));
});

test('ApiEndpoint becomes an inline code line with method, path and description', () => {
  assert.ok(markdown.includes('`POST /v1/items` — Creates one item.'));
});

test('Card and CardGrid tags are dropped, inner text kept', () => {
  assert.ok(markdown.includes('See the items guide.'));
  assert.ok(!markdown.includes('<Card'));
  assert.ok(!markdown.includes('</CardGrid>'));
});

test('import lines and stray JSX are gone from the output', () => {
  assert.ok(!markdown.includes('import Thing'));
  assert.ok(!/<[A-Z]/.test(markdown));
});

test('quoted ">" inside attributes does not break tag matching', () => {
  const src = '<Figure src="/img/x.png" alt="Select Settings > Users > Roles" caption="Menu path." frame="browser" />';
  const {markdown: out} = mdxToPlain(src);
  assert.ok(out.includes('*Image: Select Settings > Users > Roles* — Menu path.'));
  assert.ok(!out.includes('<Figure'), 'no leftover JSX when alt contains ">"');
});

test('single-quoted TabItem attributes are honored (kept tab)', () => {
  const src = [
    '<Tabs groupId="lang">',
    "<TabItem value='json' label='JSON'>",
    '',
    'payload here',
    '',
    '</TabItem>',
    "<TabItem value='python' label='Python'>",
    '',
    'dropped',
    '',
    '</TabItem>',
    '</Tabs>',
  ].join('\n');
  const {markdown: out} = mdxToPlain(src);
  assert.ok(out.includes('**JSON**'));
  assert.ok(out.includes('payload here'));
  assert.ok(!out.includes('dropped'));
});

test('a UTF-8 BOM does not hide the frontmatter', () => {
  const src = '\uFEFF---\ntitle: BOM page\ncategory: Projects\n---\n\nBody.\n';
  const {frontmatter: fm} = mdxToPlain(src);
  assert.equal(fm.title, 'BOM page');
  assert.equal(fm.category, 'Projects');
});

test('a quoted frontmatter value keeps its " # " intact', () => {
  const src = '---\ntitle: "Errors # codes"\n---\n\nBody.\n';
  const {frontmatter: fm} = mdxToPlain(src);
  assert.equal(fm.title, 'Errors # codes');
});
