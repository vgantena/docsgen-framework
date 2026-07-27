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

const site = {
  /** Product being documented. */
  product: {
    name: 'Your Product',
    tagline: 'Help center & user guides',
    /** Shown in the navbar next to the product name. */
    logo: 'img/logo.svg',
    favicon: 'img/favicon.svg',
    /** 1200×630 social-share card. Regenerate after re-branding: npm run brand-assets */
    socialCard: 'img/social-card.png',
  },

  /** Organization that owns the product. */
  org: {
    name: 'Your Company',
    url: 'https://example.com',
  },

  /** Where this docs site is deployed. */
  deploy: {
    url: 'https://docs.example.com',
    baseUrl: '/',
  },

  /**
   * The running SaaS app the docs describe — used by tools/capture.mjs and
   * tools/record.mjs as the default target for screenshots and videos.
   */
  appUrl: 'http://localhost:3000',

  /**
   * Git repository of THIS docs site. Set editBase to enable "Edit this page"
   * links, e.g. 'https://github.com/org/repo/edit/main/'. Leave '' to disable.
   */
  repo: {
    url: '',
    editBase: '',
  },

  /** Site-wide announcement bar. Set to null to hide. */
  announcement: null as null | {id: string; content: string},

  /** Top navigation (header) items. The search box is added automatically. */
  navbar: {
    items: [
      {
        label: 'API Doc',
        to: '/developers/projects-api/',
        position: 'left',
        activeBaseRegex: '^/developers/projects-api',
        icon: 'braces',
      },
      {
        label: 'User Guide',
        to: '/',
        position: 'left',
        activeBaseRegex: '^/(?!framework|developers)',
        icon: 'book-open',
      },
      {
        label: 'Developers',
        to: '/developers/',
        position: 'left',
        activeBaseRegex: '^/developers(?!/projects-api|/webhooks)',
        icon: 'terminal',
      },
      {
        label: 'Webhooks',
        to: '/developers/webhooks',
        position: 'left',
        activeBaseRegex: '^/developers/webhooks',
        icon: 'webhook',
      },
      {
        label: 'Framework',
        to: '/framework/components',
        position: 'right',
        activeBaseRegex: '^/framework',
        icon: 'layers',
      },
    ] as NavItem[],
  },

  /** Slim single-line footer: a few links beside the copyright line. */
  footer: {
    links: [
      {label: 'Getting started', to: '/getting-started'},
      {label: 'Component library', to: '/framework/components'},
      {label: 'Website', href: 'https://example.com'},
    ] as FooterLink[],
  },

  /** Local full-text search behaviour (@easyops-cn/docusaurus-search-local). */
  search: {
    hashed: true,
    indexDocs: true,
  },
};

export default site;
