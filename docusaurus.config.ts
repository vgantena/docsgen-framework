import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import site from './site.config';

/** Lucide icons for navbar items (site.config.ts `icon:` names).
 * width/height are baked in so the drawer (mobile) never renders unsized SVGs. */
const NAV_SVG = (paths: string) =>
  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

/** activeBaseRegex values in site.config.ts are written for baseUrl '/'.
 * Docusaurus matches them against the FULL pathname, so prefix the real baseUrl.
 * Accepts anchored ('^/foo') and unanchored ('/foo') input; always emits an
 * anchored regex so items can't accidentally match mid-path. */
const withBaseUrl = (regex: string) => {
  const base = site.deploy.baseUrl.replace(/\/$/, '');
  const body = regex.startsWith('^') ? regex.slice(1) : regex;
  return `^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${body}`;
};

/** Escape a string for safe interpolation into an HTML attribute/text node. */
const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

if (process.argv.includes('build') && site.deploy.url.includes('example.com')) {
  console.warn(
    '\n⚠  site.config.ts deploy.url is still the example.com placeholder — ' +
      'sitemap, canonical URLs, and social cards will point at the wrong domain.\n',
  );
}

const NAV_ICONS: Record<string, string> = {
  braces: NAV_SVG(
    '<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"/><path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>',
  ),
  'book-open': NAV_SVG(
    '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  ),
  terminal: NAV_SVG(
    '<polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/>',
  ),
  webhook: NAV_SVG(
    '<path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2"/><path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06"/><path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8"/>',
  ),
  layers: NAV_SVG(
    '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  ),
};

/**
 * Framework wiring — reads everything product-specific from site.config.ts.
 * Edit site.config.ts (structure/branding) and src/css/tokens.css (visual
 * design); this file should rarely need changes.
 */
const config: Config = {
  title: site.product.name,
  tagline: site.product.tagline,
  favicon: site.product.favicon,

  future: {
    v4: true,
    faster: true,
  },

  url: site.deploy.url,
  baseUrl: site.deploy.baseUrl,

  // `npm run build` is the documented broken-link check — fail hard on all three
  // (broken markdown links throw via markdown.hooks below).
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    mermaid: true,
    format: 'mdx', // explicit: several .md pages use JSX components and rely on MDX parsing
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  themes: [
    '@docusaurus/theme-mermaid',
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: site.search.hashed,
        indexDocs: site.search.indexDocs,
        indexBlog: false,
        docsRouteBasePath: '/',
        highlightSearchTermsOnTargetPage: true,
      },
    ],
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/', // docs-only site: guides are the homepage
          sidebarPath: './sidebars.ts',
          ...(site.repo.editBase ? {editUrl: site.repo.editBase} : {}),
          showLastUpdateTime: false,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: site.product.socialCard,
    colorMode: {
      respectPrefersColorScheme: true,
    },
    ...(site.announcement
      ? {
          announcementBar: {
            id: site.announcement.id,
            content: site.announcement.content,
            isCloseable: true,
          },
        }
      : {}),
    navbar: {
      // Desktop shows the two-tone wordmark (html item below); the plain title
      // is CSS-hidden ≥997px and serves as the mobile top-bar product name.
      title: site.product.name,
      logo: {
        alt: `${site.product.name} logo`,
        src: site.product.logo,
        srcDark: site.product.logoDark,
      },
      items: [
        {
          type: 'html' as const,
          position: 'left' as const,
          value: (() => {
            // Two-tone wordmark: split on the FIRST space — word 1 gets
            // brand-word1, everything after it (words 2+) gets brand-word2.
            const [first, ...rest] = site.product.name.split(' ');
            const restHtml = rest.length
              ? `<span class="brand-word2">${escapeHtml(rest.join(' '))}</span>`
              : '';
            return `<a href="${site.deploy.baseUrl}" class="brand-wordmark" aria-label="${escapeHtml(site.product.name)} home"><span class="brand-word1">${escapeHtml(first)}</span>${restHtml}</a>`;
          })(),
        },
        ...site.navbar.items.map((item) => ({
          position: item.position ?? 'left',
          ...(item.icon && NAV_ICONS[item.icon]
            ? {html: `${NAV_ICONS[item.icon]}<span>${escapeHtml(item.label)}</span>`}
            : {label: item.label}),
          ...(item.to ? {to: item.to} : {}),
          ...(item.href ? {href: item.href} : {}),
          ...(item.activeBaseRegex ? {activeBaseRegex: withBaseUrl(item.activeBaseRegex)} : {}),
        })),
      ],
    },
    footer: {
      style: 'light',
      links: site.footer.links.map((l) => ({
        label: l.label,
        ...(l.to ? {to: l.to} : {}),
        ...(l.href ? {href: l.href} : {}),
      })),
      copyright: `Copyright © ${new Date().getFullYear()} ${site.org.name}. All rights reserved.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
