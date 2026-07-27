# Changelog

## 0.1.0 — 2026-07-27

Initial release of the framework.

- Docusaurus 3 docs-only site: user guides, per-endpoint API reference, developer docs.
- Component library: Card (Lucide icon registry), Figure, Video, Steps, Expandable, Badge, ApiEndpoint, global Tabs; CodeBlock height cap + expand-to-modal.
- Coral theme via design tokens (`src/css/tokens.css`); all branding in `site.config.ts`.
- Tooling: screenshot capture, video record (+auto poster), Pandoc/Typst PDF manual, brand-asset generator.
- Docgen pipeline: provenance manifest + incremental change planner (`npm run docgen:plan`) with tests.
- Quality gates: markdownlint, Vale (Microsoft style + house rules), TypeScript, build link check.
