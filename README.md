# Documentation tool stack

A **generic, product-agnostic documentation framework** built on [Docusaurus](https://docusaurus.io/). Clone it, point it at your application, and produce a production-grade help center: training-quality user guides (highlighted screenshots, walkthrough videos, step carousels), per-endpoint API reference, prose + structure linting, a printable PDF manual, an incremental docs-generation planner, and a knowledge-base export bridge for AI support assistants.

**Nothing product-specific lives in framework code.** Every product surface is config, content, or a swappable flow file — see [Make it yours](#make-it-yours--the-token-map).

## What you get

- **Docs site** — docs-only Docusaurus 3, local full-text search, dark mode, Mermaid, tuned navigation with icons.
- **Training-center media pipeline** — screenshots with semantic highlight rings (yellow = fill this in, blue = press this, red = careful), walkthrough videos that never show a login and pulse every click, user-paced step carousels, all at one standard frame size, all regenerable from committed manifests with one command.
- **MDX component library** — Card, Figure (lightbox), Video (poster, captions), Carousel, Steps, Expandable, Badge, ApiEndpoint, capped code blocks with expand — globally registered, no imports in pages.
- **Authoring system** — five page templates, writing standards enforced by Vale + markdownlint, AI-assistant-ready rules (self-contained steps, mandatory alt text), and `.claude/skills/` encoding the workflows for AI-assisted authoring.
- **API reference tooling** — one-page-per-endpoint standard with multi-language samples, and `docgen:plan`: a deterministic OpenAPI diff that tells you exactly which pages to add, update, review, or remove.
- **KB export bridge** — `docgen:kb-export` converts guide pages to plain markdown and upserts them into your product's knowledge base, keyed by slug, hash-diffed so re-runs only push changes.
- **PDF manual** — the same content, print-degraded per component, via pandoc + typst.

## Quickstart

```bash
git clone <this-repo> my-product-docs && cd my-product-docs
npm install
npm run doctor     # ← validates your setup and tells you exactly what to fix
npm run start      # dev server with live reload
```

`npm run build` produces the static site in `build/`; `npm run serve` previews it with working search.

## Setup and validation

**Run `npm run doctor` first, and re-run it whenever something misbehaves.** It checks every prerequisite and configuration surface, distinguishes hard failures (wrong Node, missing dependencies) from feature-scoped warnings (no ffmpeg → only `npm run record` is blocked), and prints the exact fix command for each.

| Requirement | Needed for | Install |
| --- | --- | --- |
| Node.js ≥ 22 | everything | nodejs.org |
| Chrome or Edge | screenshots, videos | usually present; else `npx playwright install chromium` |
| ffmpeg | videos (`npm run record`) | `winget install Gyan.FFmpeg` / `brew install ffmpeg` |
| pandoc + typst | PDF manual (`npm run pdf`) | `winget install JohnMacFarlane.Pandoc Typst.Typst` |
| Vale | prose lint gate | `winget install errata-ai.Vale`, then `vale sync` |

After a winget install, open a **new** shell (or refresh PATH — see CLAUDE.md "Environment notes").

Machine-specific values live in **`.env`** (gitignored — copy `.env.example`): `APP_URL` (the running app the docs describe), `DEMO_USER`/`DEMO_PASS` (demo credentials for login and recording flows), and `KB_BASE_URL`/`KB_USER`/`KB_PASS` (knowledge-base export). **Never commit credentials; never use real customer accounts.**

## Make it yours — the token map

Every place that carries product identity, in the order you should edit them:

| Surface | What it holds |
| --- | --- |
| **`site.config.ts`** | Product name, tagline, logo paths, org name + URL (drives the footer **copyright** line), deploy URL, app URL, navbar items, footer links, announcement bar. The single source of structural identity. |
| **`src/css/tokens.css`** | Every visual decision: brand color ramp (light + dark), layout widths, type scale, screenshot highlight colors. No other file hardcodes a color or size. |
| **`docgen.config.json`** | The committed pipeline definition: docs sources for the planner, and the **`kb` section** — your product's KB category vocabulary, API base path, body cap. |
| **`.env`** | Machine/secret values only (see above). |
| **`tools/flows/login.mjs`** | ~15 lines of Playwright that sign into *your* app for `npm run login`. The only app-specific code, by design. |
| **`templates/*.md`** | Frontmatter placeholders — set the KB `category` examples to your component names. |
| **`.vale/styles/config/vocabularies/Docs/accept.txt`** | Your product's terms and brand names. |

Then run `npm run brand-assets` to regenerate the logo, favicon, and social card from the new name and colors. `npm run doctor` warns while placeholders remain.

## Author content

- New pages start from **`templates/`** (task, concept, reference, troubleshooting, api-endpoint). Writing rules live in `docs/framework/standards.md` — including the two rules that make content AI-assistant-ready: steps self-contained in text, full alt text on every image.
- Every guide page carries three KB-mapping frontmatter fields: `category` (one of your `docgen.config.json` components), `keywords` (the words users actually type, with synonyms), `audience` (`vendor` | `internal`).
- **Internal-only pages** (`audience: internal`) must also set `draft: true` — drafts are excluded from the public production build while the KB export still picks them up with internal visibility. A test gate enforces this pairing.
- The repo ships **sample content** to copy from: a generic worked example (`docs/developers/projects-api/`, `docs/guides/projects-and-workspaces`) plus complete production-grade module guides (`docs/guides/items/`, `docs/guides/parties/`) showing the full media treatment. Replace them with your product's content — they are examples, not framework.
- Working AI-assisted? The committed **`.claude/skills/`** encode the exact workflows: `ui-guide` (document a module as a training center), `record-video`, `new-api-endpoint`, `run`.

## The media pipeline

```bash
npm run login                                        # once per session → auth.json (gitignored)
npm run capture -- --url / --storage-state auth.json \
  --click "[data-testid=nav-items]" \
  --highlight "[data-testid=search]::yellow" \
  --out static/img/items/search-items.png            # 2× scale, standard 1280×800 frame
npm run record -- --flow tools/flows/items-tour.mjs \
  --out static/video/items/items-tour --storage-state auth.json
```

Rules that keep output production-grade:

- **One frame size.** Every screenshot is 1280×800 @2×. Tall forms are split into section shots with `--scroll`, never captured taller.
- **Semantic rings.** `::yellow` = fields to fill, `::action` = the control to press, `::red` = destructive. Colors come from tokens so they match the site.
- **Videos never show login** (`--storage-state`), every click pulses, and flows use the `ui` helper (`ui.click`/`ui.fill`/`ui.spotlight`) so viewers can follow along.
- **Commit the recipe.** Each module's media lives in a manifest (`tools/media/<module>.json`); `npm run media -- --manifest tools/media/<module>.json` re-shoots everything identically after a UI change.

Media lives in `static/img/<module>/` and `static/video/<module>/`, ships with the site build, and stays same-origin in production.

**Keeping media honest at scale:**

- `npm run media -- --manifest <m> --check` — re-shoots to a temp dir and pixel-diffs against the committed screenshots; exits 1 when any shot drifts past the threshold (default 3%). Run it nightly against your dev app to catch UI changes that made docs media stale — the tool also fails loudly when the app itself is broken, which is a signal in its own right.
- `npm run media:optimize` — recompresses every screenshot with sharp (palette PNG, visually lossless, ~50% smaller). Run it after re-shooting, before committing.
- `npm run audit:selectors -- --app <path-to-app-src>` — verifies every `data-testid` in your manifests and flows still exists in the app source, including template-literal testids. Cheap insurance against selector rot between re-shoots.

## Operating at scale

- **Accessibility gate**: CI runs Lighthouse (`lighthouserc.json`) against the built site and fails below a 0.9 accessibility score on key pages.
- **Feedback loop**: set `feedback.endpoint` in `site.config.ts` to enable the "Was this page helpful?" widget under every page (votes POST as `{route, helpful, ts}`); set `analytics.gtagTrackingId` for page analytics. Both ship disabled.
- **Localization**: add locale codes to `site.config.ts` → `locales.all` (a language dropdown appears automatically), then `npm run write-translations` and translate under `i18n/<locale>/`.
- **Doc versioning** (when a product ships versioned releases): `npx docusaurus docs:version 1.0` snapshots the current docs; add `{type: 'docsVersionDropdown'}` to the navbar items in docusaurus.config.ts. Cut versions sparingly — each snapshot is a full copy to maintain.
- **Scheduled KB sync**: run `npm run docgen:kb-export -- --write` from your deploy pipeline or a cron on the environment that can reach the platform API (CI runners usually cannot) — the hash diff makes it free when nothing changed.

## API reference and the docgen planner

Author one page per endpoint under `docs/developers/<resource>-api/` from `templates/api-endpoint.md`. When you have an OpenAPI spec:

```bash
npm run docgen:plan -- --spec path/to/openapi.json
```

produces a deterministic ADD / UPDATE / REVIEW / REMOVE / SKIP plan — per-operation hashing (including transitively resolved `$ref`s) means a schema edit flags exactly the affected pages, and human-edited pages are never overwritten. See `docgen/README.md`.

## Knowledge-base export

```bash
npm run docgen:kb-export             # dry-run: deterministic plan, writes docgen/kb-plan.json
npm run docgen:kb-export -- --write  # upsert via your platform API, update docgen/kb-manifest.json
```

Pages with the three KB frontmatter fields are converted to plain markdown (Steps → numbered lists, Figures → alt text, Tabs → JSON + curl only, admonitions → bold prefixes) and upserted **keyed by slug** — `category` validated against your vocabulary, `keywords` → tags, `audience` → visibility, status `published`. Hash-diffing makes re-runs idempotent: only changed pages push, so your AI assistant's corpus stays current for the cost of a diff. Add `--archive-orphans` to archive KB articles whose source page was deleted. Configure the target in `docgen.config.json` (`kb` section) and credentials in `.env`.

**Different KB API?** The dry-run's `docgen/kb-plan.json` contains the complete article payloads and is a stable contract — consume it with your own uploader instead of `--write`. The planner/transform stays in the framework; the last-mile HTTP is yours to swap.

## Quality gates

All seven before committing — CI (`.github/workflows/ci.yml`) enforces the same set:

```bash
npm run doctor && npm run lint:md && npm run lint:prose && npm run lint:js \
  && npm run typecheck && npm test && npm run build   # build catches broken links
```

## Production deployment

`npm run build` → ship `build/` to any static host (or `npm run deploy` for GitHub Pages after setting `organizationName`/`projectName`). Before going live: set real URLs in `site.config.ts` (sitemap/canonicals/social cards use them), update `static/robots.txt`, re-run `npm run brand-assets`. Serve `/img/` and `/video/` with long-lived immutable cache headers. Media deploys with the site — same origin, no external hosts, atomic rollbacks include the images.

## Repo layout

```
site.config.ts        product/org/navigation (identity)
docgen.config.json    pipeline + KB vocabulary (committed config)
src/css/tokens.css    all visual design tokens
src/components/       MDX component library
docs/                 content (yours) + docs/framework/ (framework's own manual)
templates/            page templates with KB frontmatter
tools/                capture, record, login, media, doctor, docgen-plan, docgen-kb-export
tools/flows/          Playwright flows (login + per-video walkthroughs)
tools/media/          per-module media manifests (the committed recipes)
docgen/               planner + KB export manifests and plans
.claude/skills/       AI-assisted authoring workflows
```

## Adoption checklist

1. `npm install` → `npm run doctor` — fix failures, note feature warnings.
2. Rebrand in one command (add `--fresh --yes` to also clear the worked-example content; `--dry-run` to preview):

   ```bash
   npm run init-product -- --name "YourProduct" --org "Your Org" \
     --org-url https://yourorg.com --app-url http://localhost:3000 \
     --docs-url https://docs.yourproduct.com
   ```

   Then adjust `tokens.css` colors and run `npm run brand-assets`.
3. Fill `.env`; rewrite `tools/flows/login.mjs` for your app; `npm run login`.
4. Set your KB vocabulary in `docgen.config.json` (or remove the `kb` section if unused).
5. Replace the sample content in `docs/` module by module — follow the `ui-guide` skill recipe; keep gates green between modules.
6. `npm run docgen:kb-export -- --write` after each module if you feed an assistant.
7. Ship `build/` — see [Production deployment](#production-deployment).
