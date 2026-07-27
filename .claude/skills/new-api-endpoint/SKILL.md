---
name: new-api-endpoint
description: Author a new API endpoint reference page following the project standard (per-endpoint page, JSON-first sample tabs, error codes, business rules).
---

# Add an API endpoint page

One endpoint = one page under `docs/developers/<resource>-api/`. Never append endpoints to a shared page.

## Steps

1. Copy `templates/api-endpoint.md` to `docs/developers/<resource>-api/<verb-object>.mdx` (e.g. `archive-project.mdx`). Set `sidebar_position` after the existing pages and a `METHOD /path — purpose` description in frontmatter.
2. Keep the section order exactly: **Overview → Request → Response → Status and error codes → Business rules.**
   - Overview: 2–3 sentences + `<Badge>` chips for minimum role and plan gates.
   - `<ApiEndpoint method="…" path="/v1/…">one-liner</ApiEndpoint>` directly under the H1.
   - Sample request: `<Tabs groupId="lang">` with **JSON payload first** (when the endpoint has a body), then curl, Java (`java.net.http`), Python (`requests`), JavaScript (`fetch`). The shared `groupId` syncs the reader's language choice site-wide.
   - Status table columns: `Status | Code | When` — include the machine-readable code slug for every error.
   - Business rules: constraints the schema can't express — role/plan gates, uniqueness, limits, idempotency, webhook side effects, retention.
3. Add the endpoint row to the resource's `index.mdx` endpoints table. If the resource is new, create the folder with a `_category_.json` (`link: {type: doc, id: .../index}`) and an index page modeled on `docs/developers/projects-api/index.mdx` (object schema, lifecycle diagram, roles/plans table).
4. New technical terms → `.vale/styles/config/vocabularies/Docs/accept.txt` (one regex per line, e.g. `[Ii]dempotency`).
5. Run all four gates: `npm run lint:md`, `npm run lint:prose`, `npm run typecheck`, `npm run build` (build catches broken links).

## Style traps that fail Vale

- "e.g." → "for example"; "it is" → "it's"; never "we"; no "simply/just/easy".
- Spaced em-dashes ( — ) are fine (house style).
