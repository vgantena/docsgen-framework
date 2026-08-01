/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  GLOBAL SITE CONFIGURATION — single source of truth for the docs framework.
 *
 *  Everything product- or org-specific lives here: names, URLs, navigation,
 *  footer, announcement bar. Visual design (colors, radii, shadows, frames)
 *  lives in src/css/tokens.css. No other file should hardcode either.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface NavItem {
  label: string;
  to?: string;
  href?: string;
  position?: 'left' | 'right';
  /** Regex over the current path deciding when this item shows as active. */
  activeBaseRegex?: string;
  /** Lucide icon name rendered before the label (see NAV_ICONS in docusaurus.config.ts). */
  icon?: string;
}

export interface FooterLink {
  label: string;
  to?: string;
  href?: string;
}

/** Organization that owns the product — shared const so nothing duplicates the URL. */
const org = {
  name: 'Your Company',
  url: 'https://example.com',
};

/**
 * Git repository of THIS docs site. `url` powers the footer "GitHub" link
 * (omitted while ''); set editBase to enable "Edit this page" links,
 * e.g. 'https://github.com/org/repo/edit/main/'. Leave '' to disable.
 */
const repo = {
  url: '',
  editBase: '',
};

const site = {
  /** Product being documented. */
  product: {
    name: 'Your Product',
    tagline: 'Help center & user guides',
    /** Shown in the navbar next to the product name. */
    logo: 'img/logo.svg',
    /** Dark-theme variant of the logo (lighter stroke for dark backgrounds). */
    logoDark: 'img/logo-dark.svg',
    favicon: 'img/favicon.svg',
    /** 1200×630 social-share card. Regenerate after re-branding: npm run brand-assets */
    socialCard: 'img/social-card.png',
  },

  org,

  /** Where this docs site is deployed. */
  deploy: {
    url: 'https://docs.example.com',
    baseUrl: '/',
  },

  /**
   * Locales served by the site. Add codes such as 'hi' or 'te' to `all` to
   * enable a language dropdown in the navbar, then run
   * `npm run write-translations` to scaffold the translatable strings.
   * `all` must contain `default`.
   */
  locales: {
    default: 'en',
    all: ['en'] as [string, ...string[]],
  },

  /**
   * The running SaaS app the docs describe — used by tools/capture.mjs and
   * tools/record.mjs as the default target for screenshots and videos.
   */
  appUrl: 'http://localhost:3000',

  repo,

  /** Site-wide announcement bar. Set to null to hide. */
  announcement: null as null | {id: string; content: string},

  /** Top navigation (header) items. The search box is added automatically. */
  navbar: {
    items: [
      {
        label: 'API Doc',
        // Link points at the primary API resource; the regex matches ANY
        // /developers/<resource>-api section so future resources light it up.
        to: '/developers/projects-api/',
        position: 'left',
        activeBaseRegex: '^/developers/[^/]+-api(/|$)',
        icon: 'braces',
      },
      {
        label: 'User Guide',
        to: '/',
        position: 'left',
        // Catch-all for guide pages: everything except the other sections and
        // non-doc routes (/search, generated /category/ indexes) — those must
        // activate nothing / their own item.
        activeBaseRegex: '^/(?!framework(/|$)|developers(/|$)|search(/|$)|category/)',
        icon: 'book-open',
      },
      {
        label: 'Developers',
        to: '/developers/',
        position: 'left',
        // Excludes every <resource>-api section (API Doc item) and webhooks.
        activeBaseRegex: '^/developers(?!/[^/]+-api(/|$)|/webhooks(/|$))',
        icon: 'terminal',
      },
      {
        label: 'Webhooks',
        to: '/developers/webhooks',
        position: 'left',
        activeBaseRegex: '^/developers/webhooks(/|$)',
        icon: 'webhook',
      },
      {
        label: 'Framework',
        to: '/framework',
        position: 'right',
        activeBaseRegex: '^/framework(/|$)',
        icon: 'layers',
      },
    ] as NavItem[],
  },

  /** Slim single-line footer: a few links beside the copyright line. */
  footer: {
    links: [
      {label: 'Getting started', to: '/getting-started'},
      {label: 'Component library', to: '/framework/components'},
      {label: 'Website', href: org.url},
      // Repo link appears automatically once repo.url is set.
      ...(repo.url ? [{label: 'GitHub', href: repo.url}] : []),
    ] as FooterLink[],
  },

  /** Local full-text search behaviour (@easyops-cn/docusaurus-search-local). */
  search: {
    hashed: true,
    indexDocs: true,
  },

  /**
   * "Was this page helpful?" widget under every doc page. Empty string =
   * widget hidden; set to your API endpoint to enable, for example
   * '/api/docs-feedback'. Each vote POSTs JSON {route, helpful, ts}.
   */
  feedback: {
    endpoint: '',
  },

  /**
   * Google Analytics (gtag.js), active on production builds only. Empty
   * string = disabled; set to a measurement ID, for example 'G-XXXXXXXXXX'.
   */
  analytics: {
    gtagTrackingId: '',
  },
};

export default site;
