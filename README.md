# Documentation tool stack

A reusable help-center framework built on [Docusaurus](https://docusaurus.io/): docs-only site, custom MDX components, screenshot/video tooling, prose + structure linting, and a printable PDF manual — all driven from two config files.

- **Structure & branding**: [site.config.ts](site.config.ts) (product name, URLs, navbar, footer)
- **Visual design**: [src/css/tokens.css](src/css/tokens.css) (colors, radii, shadows, frames)
- Full details: the **Configuration** page (`docs/framework/configuration.md`) and **Writing standards** (`docs/framework/standards.md`)

## Prerequisites

- Node.js ≥ 20
- For media & publishing tools — pandoc, typst, vale, ffmpeg (all cross-platform single binaries):

  ```powershell
  # Windows
  winget install JohnMacFarlane.Pandoc Typst.Typst errata-ai.Vale Gyan.FFmpeg
  ```

  ```bash
  # macOS
  brew install pandoc typst vale ffmpeg
  # Linux (Debian/Ubuntu; vale + typst from their GitHub releases)
  sudo apt-get install -y pandoc ffmpeg
  ```

  Then, once, on any OS:

  ```bash
  npx playwright install ffmpeg   # Playwright's bundled recorder codec
  vale sync                       # download prose-lint style packages
  ```

  Screenshots/videos use your installed Chrome or Edge; run `npx playwright install chromium` only if you have neither.

## Install & run

```bash
npm install
npm run start     # dev server with live reload
npm run build     # static site into build/
npm run serve     # serve the production build locally
```

## Authoring workflow

| Command | Purpose |
| --- | --- |
| `npm run capture -- --url /settings --out static/img/settings/api-keys.png` | Screenshot a page (2× scale, optional `--highlight "#selector"`) |
| `npm run record -- --flow tools/flows/example-flow.mjs --out static/video/example` | Record a short workflow video (webm → web-ready mp4) |
| `npm run lint:md` | Structure linting (markdownlint) |
| `npm run lint:prose` | Language linting (Vale, Microsoft style + house rules) |
| `npm run pdf` | Build the printable manual (`tools/pdf-manifest.json` → `build/manual.pdf`) |
| `npm run docgen:plan -- --spec <openapi.json>` | Incremental docs plan: ADD/UPDATE/REVIEW/REMOVE/SKIP (see `docgen/README.md`) |
| `npm run brand-assets` | Regenerate social card + favicon.ico from the current branding |
| `npm run typecheck` | TypeScript check for components/config |
| `npm test` | Unit tests (docgen planner) |

New pages start from a template in [templates/](templates/): `task.md`, `concept.md`, `reference.md`, `troubleshooting.md`.

## Project standards (for anyone taking this repo)

Everything a new contributor or AI assistant needs ships in the repo:

- **[CLAUDE.md](CLAUDE.md)** — the project rulebook: commands, architecture map, design standards (coral tokens, Lucide-only icons, card/nav/footer patterns), content rules, environment notes.
- **[.claude/skills/](.claude/skills/)** — repeatable workflows: `run` (launch + verify), `new-api-endpoint` (author an endpoint page to standard), `record-video` (record + embed a clip).
- **[templates/](templates/)** — page templates including the per-endpoint API reference structure.
- **Linters** — [.markdownlint-cli2.jsonc](.markdownlint-cli2.jsonc) and [.vale.ini](.vale.ini) with the project vocabulary in `.vale/styles/config/vocabularies/Docs/` (the Microsoft package restores with `vale sync`).
- **[.vscode/extensions.json](.vscode/extensions.json)** — recommended editor extensions (markdownlint, Vale, MDX, EditorConfig).

## Quality gates

Run before committing — all five must pass (CI enforces the same set):

```bash
npm run lint:md
npm run lint:prose
npm run typecheck
npm test
npm run build     # onBrokenLinks: throw catches dead links
```

## Before deploying for real

- Set your product/org/URLs in [site.config.ts](site.config.ts) — the build warns while `deploy.url` is still the example.com placeholder (sitemap/canonicals/social cards use it).
- Update `static/robots.txt` with your real host.
- Re-run `npm run brand-assets` after changing the name, logo, or theme color.
- `npm run deploy` targets GitHub Pages and additionally needs `organizationName`/`projectName` in docusaurus.config.ts — or ship `build/` to any static host.
