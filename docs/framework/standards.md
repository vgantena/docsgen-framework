---
sidebar_position: 3
title: Writing standards
description: Page types, style rules, media pipeline, and the quality gates every page must pass.
---

# Writing standards

These standards keep every page consistent regardless of who (or what) wrote it.

## Page types

Every page is exactly one of five types — never mix them:

| Type | Purpose | Template |
| --- | --- | --- |
| Concept | What something is and why it matters — no steps | `templates/concept.md` |
| Task | One goal, numbered steps | `templates/task.md` |
| Reference | Tables of settings, limits, fields | `templates/reference.md` |
| API endpoint | One REST endpoint: schemas, samples, errors, business rules | `templates/api-endpoint.md` |
| Troubleshooting | Symptom → cause → fix | `templates/troubleshooting.md` |

## Page templates

Start every new page by copying its template from the `templates/` folder at the repo root. The task template skeleton:

```markdown
---
title: <Verb + object, e.g. "Invite team members">
description: <One sentence, ≤160 chars, states the outcome>
sidebar_position: <n>
---

One-paragraph intro: what you'll accomplish and when you'd want to.

## Before you begin
## Steps
## Verify
## Troubleshooting   (only if needed)
## Related
```

### KB frontmatter fields

Every template also carries three fields that map the page into the knowledge base (in-app help and the AI support assistant):

| Field | Purpose |
| --- | --- |
| `category` | The KB component the page belongs to (Items, POS, Sale Invoices, …) — groups pages in the KB. |
| `keywords` | What users actually type when searching. Include the synonyms users use, not only the product's terms — bill/invoice, label/barcode. |
| `audience` | `vendor` or `internal` — controls whether the page is visible in the customer-facing KB. |

Pages marked `audience: internal` must also set `draft: true` in their frontmatter: drafts never ship in the public production build, while the KB export still includes them with internal visibility. A test gate (`npm test`) enforces the pairing.

## Style rules

- Second person ("you"), imperative steps ("Select **Save**"), present tense.
- One action per numbered step — if a step needs "and," split it.
- Bold UI element names exactly as the product shows them: **Settings**.
- Keyboard keys in `<kbd>` tags.
- Define jargon at first use or link its concept page.
- Banned words in docs: `simply`, `just`, `easy`, `easily`, marketing superlatives. Vale enforces these as errors (`Docs.BannedWords`).
- Every step must be self-contained in text — never "as shown below", "click the highlighted button", or any instruction whose meaning lives only in an image. Screenshots illustrate; text carries the meaning. Guide content is also consumed without images — by the in-app help search and by an AI support assistant that reads the text alone.
- `:::warning` before any destructive or irreversible action.

## API reference pages

Start from `templates/api-endpoint.md` and follow it exactly:

- **One page per endpoint**, under `docs/developers/<resource>-api/` — never append endpoints to a shared page.
- **Section order is fixed**: Overview (with role and plan `<Badge>` chips) → Request → Response → Status and error codes → Business rules.
- **Sample request tabs** use `<Tabs groupId="lang">` so the reader's language choice syncs site-wide. Tab order: **JSON payload first** (when the endpoint has a body), then curl, Java, Python, JavaScript.
- **Response** includes a `Field | Type | Description` schema table, with a lead-in link to the shared object definition.
- **Every error row carries a machine-readable code slug** (`validation_failed`, `rate_limited`, `server_error`, …) matching the [error format](/developers/#errors).
- When you add an endpoint, **update the endpoints table on the resource's index page** (for example [Projects API](/developers/projects-api/)).

## Media pipeline

### Screenshots

```bash
npm run capture -- --url /settings --out static/img/settings/api-keys.png --highlight "#new-key-btn"
```

- 1280×800 viewport at 2× scale, element highlighting built in.
- Name files `verb-object.png` under `static/img/<section>/`.
- Every image needs real alt text — describe what's shown.
- Only seeded demo data on screen. Never real customer data.

### Short videos

```bash
npm run record -- --flow tools/flows/example-flow.mjs --out static/video/projects/create-project
```

- 15–60 seconds, silent. Playwright records `.webm`; ffmpeg produces the web-ready `.mp4` plus a poster `.jpg` automatically.
- Store both files under `static/video/<section>/` and embed with the generated poster: `<Video src="/video/projects/create-project.mp4" poster="/video/projects/create-project.jpg" />`. Longer tutorials go to your video host and get embedded instead.

## Quality gates

Run before committing — all six must pass:

```bash
npm run lint:md      # markdownlint-cli2: structure
npm run lint:prose   # Vale: errors block; Microsoft-style warnings are advisory
npm run lint:js      # ESLint over tools/ and tests/
npm run typecheck    # components and config
npm test             # tooling unit tests
npm run build        # broken-link check
```

## PDF manual

The same Markdown builds a printable manual (chapters listed in `tools/pdf-manifest.json`):

```bash
npm run pdf
```

Component notes: `Figure` becomes a plain image, `Video` becomes a link line, Mermaid diagrams are skipped in PDF output.
