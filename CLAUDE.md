# Documentation tool stack — project rules

Reusable Docusaurus 3 help-center framework: user guides, per-endpoint API reference, developer docs, screenshot/video tooling, prose + structure linting, printable PDF manual.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run doctor` | Setup validator — run FIRST after cloning and whenever tooling misbehaves; distinguishes hard failures from feature-scoped warnings with exact fix commands |
| `npm run start -- --port 3400 --no-open` | Dev server (live reload; search is build-only) |
| `npm run build` | Production build — also the broken-link check |
| `npm run serve -- --port 3300 --no-open` | Serve the production build (full search works here) |
| `npm run typecheck` | TypeScript check |
| `npm run lint:md` | markdownlint (structure) |
| `npm run lint:prose` | Vale (language) — errors block (spelling, we-voice, banned house words); Microsoft-style warnings/suggestions are advisory |
| `npm run lint:js` | ESLint over tools/ and tests/ |
| `npm run capture -- --url <path> --out static/img/...png` | Screenshot a page (2× scale; repeatable `--highlight "sel[::red\|yellow\|action]"` — yellow = fill-in, red = destructive, action = press-this; repeatable `--click "#sel"` for state-routed SPAs; `--storage-state auth.json` for authenticated pages) |
| `npm run record -- --flow tools/flows/<f>.mjs --out static/video/<name> --storage-state auth.json` | Record training video → mp4 + poster; auto click-pulses; flows get a `ui` helper (`ui.click`/`ui.fill`/`ui.spotlight` = outline-then-act). Never record the login screen |
| `npm run login` | Sign in via `tools/flows/login.mjs` (DEMO_USER/DEMO_PASS from `.env`) and save `auth.json` (gitignored) for capture/record |
| `npm run media -- --manifest tools/media/<module>.json` | Regenerate a module's entire media set from its committed manifest (`--only screenshots\|videos`, `--filter <substring>`). ALL screenshots share the single 1280×800 frame — tall forms are split into section shots via `--scroll`, never a taller viewport |
| `npm run media -- --manifest <m> --check` | DRIFT DETECTION: re-shoot to temp + pixel-diff against committed screenshots; exits 1 past `--drift-threshold` (default 3%). Run nightly against the dev app to catch stale docs media |
| `npm run media:optimize` | Losslessly-visually recompress `static/img/**.png` via sharp (~50% smaller); only overwrites when >5% smaller and dimensions match. Run AFTER re-shooting, BEFORE committing |
| `npm run audit:selectors -- --app <app-src-path>` | Verify every `data-testid` selector in media manifests + flows still exists in the app source (handles template-literal testids); exit 1 on missing |
| `npm run pdf` | Build `build/manual.pdf` from `tools/pdf-manifest.json` |
| `npm run docgen:plan -- --spec <openapi.json>` | Incremental docs plan: ADD/UPDATE/REVIEW/REMOVE/SKIP (see `docgen/README.md`) |
| `npm run docgen:kb-export` | Plan (default) or `--write` upsert of KB-mapped docs pages into the product KB via the platform API — keyed by slug, hashed in `docgen/kb-manifest.json`, only changed pages push. Needs KB_USER/KB_PASS in `.env` for `--write` |
| `npm test` | Unit tests (docgen planner) |
| `npm run brand-assets` | Regenerate social card + favicon.ico after a re-brand |

**Quality gates — all six must pass before committing:** `lint:md`, `lint:prose`, `lint:js`, `typecheck`, `test`, `build`. CI (`.github/workflows/ci.yml`) enforces the same set.

Prerequisites beyond `npm install` (one-time): pandoc, typst, vale, ffmpeg — Windows: `winget install JohnMacFarlane.Pandoc Typst.Typst errata-ai.Vale Gyan.FFmpeg`; macOS: `brew install pandoc typst vale ffmpeg`; Linux: apt for pandoc/ffmpeg, GitHub releases for vale/typst. Then `vale sync` and `npx playwright install ffmpeg`. Screenshots/videos use installed Chrome/Edge.

## Architecture — where things are decided

- **site.config.ts** — ALL product/org-specific structure: names, URLs, navbar items (with `icon` + `activeBaseRegex`), footer links. No other file hardcodes these.
- **src/css/tokens.css** — ALL visual design as tokens (brand ramp, layout widths, type scale, component tokens). Never hardcode a color/size in components or custom.css; add a token.
- **src/css/custom.css** — maps tokens onto the Docusaurus theme; global element styling.
- **src/components/** — MDX components, globally registered in `src/theme/MDXComponents.tsx` (no imports needed in docs pages): Card/CardGrid, Figure, Video, Steps, Expandable, Badge, ApiEndpoint, Carousel (user-paced step slideshow — the lightweight alternative to Video), Tabs/TabItem.
- **src/theme/CodeBlock/** — wrapper adding max-height + scrollbar + expand-to-fullscreen to every code block.
- **tools/** — capture.mjs, record.mjs (+ flows/), build-pdf.mjs, pdf-manifest.json.
- **templates/** — authoring templates: task, concept, reference, troubleshooting, **api-endpoint**.

## Design standards (user-established — do not regress)

- Theme color is **coral** — light `#cc3f22` (deliberately darker than the brand coral to keep WCAG AA contrast on white), dark `#ff8a70` — defined only in tokens.css.
- **Lucide outline icons only. No emojis anywhere.** Cards use the name-keyed registry in `src/components/Card/icons.tsx` (tinted chip, icon + title on ONE row). Navbar icons live in `NAV_ICONS` in docusaurus.config.ts. Logo/favicon are Lucide `book-marked`, coral stroke, no background.
- Brand wordmark: words joined, two-tone (`brand-word1`/`brand-word2` tokens), flush against the logo.
- Navbar standard: API Doc, User Guide, Developers, Webhooks (left) + Framework (right), each with icon and a precise `activeBaseRegex` so exactly one item is active.
- Footer: single slim row — links left, copyright right.
- Content column capped at `--doc-content-width`; heading scale via `--doc-h1/h2/h3-size`.

## Content standards

- Writing rules live in `docs/framework/standards.md` (docs speak to "you", sentence-case headings, banned words: "simply/just/easy", `:::warning` before destructive actions). Spaced em-dashes ( — ) are house style (Microsoft.Dashes disabled).
- New pages start from a template in `templates/`. New project terms go in `.vale/styles/config/vocabularies/Docs/accept.txt` (regex per line, case handled like `[Ww]ebhooks?`).
- **API reference**: ONE page per endpoint under `docs/developers/<resource>-api/`, following `templates/api-endpoint.md` exactly: Overview (+role/plan badges) → Request (params tables; Sample request tabs with **JSON payload first**, then curl/Java/Python/JavaScript, `groupId="lang"`) → Response (+schema table) → Status and error codes (with machine-readable code slugs) → Business rules. Update the resource index endpoints table when adding one.
- Media: screenshots via `npm run capture` (name files `verb-object.png` under `static/img/<section>/`), videos via `npm run record` — embed with `<Video src poster>` using the auto-generated poster.

## Docs-generation pipeline (incremental)

Config: `docgen.config.json` (committed pipeline definition) + `.env` (machine-specific; template `.env.example` — `APP_URL` is read by capture/record, `DEMO_USER`/`DEMO_PASS` are available to recording flows). Provenance lives in `docgen/manifest.json` (seeded with the hand-authored projects-api pages as `humanEdited`); the planner is `npm run docgen:plan -- --spec <openapi.json>` → deterministic ADD/UPDATE/REVIEW/REMOVE/SKIP plan, with REMOVE scoped to operation-vs-page. Rules: generation touches ONLY ADD+UPDATE pages; `humanEdited: true` pages route to REVIEW, never overwritten; SKIP pages stay byte-identical; a `templateVersion` bump is the only full-regeneration trigger. The generation step itself is currently manual/AI-assisted (follow `/new-api-endpoint` for each ADD) — only the planner is automated. Full details: `docgen/README.md`.

## Environment notes

- After winget installs, a fresh shell may miss PATH updates: prefix with
  `$env:PATH = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`.
- Changes to docusaurus.config.ts / site.config.ts / src/theme wrappers need a dev-server restart; CSS and docs hot-reload.
- Dev-server search shows "index only available when you run docusaurus build" — expected; test search on the served production build.
