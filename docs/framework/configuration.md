---
sidebar_position: 2
title: Configuration
description: Re-brand and re-theme the entire site from two files — site.config.ts and tokens.css.
---

# Configuration

The framework has exactly **two configuration surfaces**. Nothing else needs editing to re-brand the site for a different product.

| File | Controls |
| --- | --- |
| `site.config.ts` | Product name, logo, URLs, header navigation, footer links, announcement bar, search behaviour, app URL for captures |
| `src/css/tokens.css` | Every visual value: colors, fonts, radii, shadows, spacing, frames, cards, tables, steps, badges — light and dark |

## Structure and branding — `site.config.ts`

```ts
const site = {
  product: {name: 'Your Product', tagline: '…', logo: 'img/logo.svg'},
  org: {name: 'Your Company', url: 'https://example.com'},
  deploy: {url: 'https://docs.example.com', baseUrl: '/'},
  appUrl: 'http://localhost:3000',   // what capture/record screenshots target
  announcement: null,                 // or {id, content} for a site-wide banner
  navbar: {items: [{label: 'Guides', to: '/'}]},
  footer: {links: [ /* … */ ]},
  locales: {default: 'en', all: ['en']},   // more than one entry = language dropdown
  feedback: {endpoint: ''},                // '' hides the page-feedback widget
  analytics: {gtagTrackingId: ''},         // '' disables Google Analytics
};
```

Changing `product.name` updates the browser title, header, and social metadata everywhere.

### Optional integrations

Three settings ship disabled — the site behaves identically until you fill them in:

| Setting | Default | What a value enables |
| --- | --- | --- |
| `feedback.endpoint` | `''` (widget hidden) | A "Was this page helpful?" row under every doc page. Set an API endpoint, for example `'/api/docs-feedback'`; each vote POSTs JSON `{route, helpful, ts}` to it. See [Page feedback](/framework/components#page-feedback). |
| `analytics.gtagTrackingId` | `''` (disabled) | Google Analytics via gtag.js on production builds (IP anonymization on). Set a measurement ID, for example `'G-XXXXXXXXXX'`. |
| `locales` | `{default: 'en', all: ['en']}` | Translations. Add codes such as `'hi'` or `'te'` to `all` to get a language dropdown in the navbar, then run `npm run write-translations` to scaffold the translatable strings under `i18n/`. |

## Visual design — `src/css/tokens.css`

Change a token once; every component follows. The most common re-brand is three lines:

```css
:root {
  --doc-color-primary: #4f46e5;   /* your brand color */
  --doc-radius-md: 10px;          /* overall roundness */
  --doc-font-body: system-ui, …;  /* your typeface */
}
```

Each area has its own token group so you can tune one component class globally without touching the others:

| Token group | Applies to |
| --- | --- |
| `--doc-color-*` | Brand ramp, surfaces, text, borders |
| `--doc-frame-*` | Figure and Video frames: border, radius, shadow, browser-chrome bar, captions |
| `--doc-card-*` | Card background, border, radius, shadows, min column width |
| `--doc-table-*` | Header fill, zebra stripes, hover, borders — every Markdown table |
| `--doc-step-*` | Step number circles and connector line |
| `--doc-badge-*` | Per-variant badge colors |
| `--doc-transition-*` | All motion (set to `0s` to disable animation site-wide) |

Dark mode has its own override block — `[data-theme='dark']` — with the same token names.

## Navigation

- **Header (navbar):** edit `navbar.items` in `site.config.ts`.
- **Sidebar:** generated from the `docs/` folder tree. Order pages with `sidebar_position` frontmatter; configure folders (label, order, collapsed) with a `_category_.json`.
- **Breadcrumbs and next/previous links** are automatic.

## Search

Full-text local search is pre-wired (`@easyops-cn/docusaurus-search-local`) — it indexes at build time and needs no external service.

## Versioning (when you need it)

Snapshot the current docs as a version any time:

```bash
npx docusaurus docs:version 1.0
```
