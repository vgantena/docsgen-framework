---
name: run
description: Launch the docs site locally and verify changes in a real browser (dev server + production build with working search).
---

# Run and verify the docs site

## Dev server (live reload)

```powershell
npm run start -- --port 3400 --no-open
```

- Docs/CSS/component edits hot-reload. Changes to `docusaurus.config.ts`, `site.config.ts`, or anything under `src/theme/` require a **restart**.
- Search on the dev server intentionally shows "index only available when you run docusaurus build" — not a bug.
- Deep links may 404 from curl on first hit (lazy route compilation); load `/` in a browser and navigate.

## Production build (full search, link check)

```powershell
npm run build
npm run serve -- --port 3300 --no-open
```

`build` fails on broken links (`onBrokenLinks: throw`) — treat that as a gate, not an annoyance.

## Verify like a user

Drive a real browser (Playwright launches installed Chrome/Edge). Minimum smoke pass after visual changes:

1. Homepage renders (cards, sidebar, navbar icons).
2. One API endpoint page: method badge, tabs switch (JSON/curl/Java/Python/JavaScript), code block expand button opens the overlay.
3. Search on the production build: Ctrl+K, type a term, click a result — term is highlighted on the target page.
4. Toggle dark mode — coral tokens flip, nothing unreadable.

Screenshots for docs go through `npm run capture` (never ad-hoc tools) so viewport/scale stay consistent.

## Quality gates before commit

```powershell
npm run lint:md; npm run lint:prose; npm run typecheck; npm test; npm run build
```

All five must pass. Vale errors block; warnings/suggestions are advisory.
