# Docs-generation pipeline (incremental, provenance-tracked)

The strategy that keeps generated docs consistent across source-code builds:
**never regenerate what didn't change, and never let AI decide what changed.**

## Pieces

- **docgen.config.json** (repo root, committed) — pipeline definition: source repos, extractors, output mapping, `templateVersion`.
- **.env** (gitignored; template in `.env.example`) — machine/environment secrets: app URL, demo credentials, tokens.
- **manifest.json** — provenance: for every generated page, which operations it documents, the per-operation contract hashes, source-file hashes, and a `humanEdited` flag. Written by generation, read by the planner. `examples/manifest.example.json` shows a populated one.
- **tools/docgen-plan.mjs** — the planner. Diffs a freshly extracted OpenAPI spec against the manifest and emits a deterministic change plan.

## Flow (each new source build)

```text
source repo build
  → extract contract (OpenAPI json — deterministic, no AI)
  → npm run docgen:plan -- --spec <new-spec.json> [--write]
  → plan: ADD / UPDATE / REVIEW / REMOVE / SKIP
  → generation (AI, template-constrained) touches ONLY ADD + UPDATE
  → gates (lint:md, lint:prose, typecheck, build) → PR → human review
  → generation updates manifest.json hashes in the same PR
```

| Action | Meaning |
| --- | --- |
| `SKIP` | Contract hash unchanged — page is not touched (byte-identical). The consistency guarantee. |
| `ADD` | New operation — generate a page from `templates/api-endpoint.md`. |
| `UPDATE` | Contract changed — regenerate; AI sections are updated against their previous text for the named change, not re-rolled. |
| `REVIEW` | Contract changed (or an operation disappeared) on a `humanEdited` page — flagged for a human instead of acted on. |
| `REMOVE` | Operation gone from the spec. Scoped: `scope: "page"` only when NO other operation still uses the page; `scope: "operation"` means delete just that section — never the file. |

The generation step is currently manual/AI-assisted: run the plan, then author each
ADD via the `new-api-endpoint` skill and fold each UPDATE into the existing page.
The committed manifest is pre-seeded with the hand-authored `projects-api` pages
(`humanEdited: true`), so a real spec's first plan routes them to REVIEW instead of
proposing duplicates.

Change detection is per-operation: each operation is hashed together with every
`$ref` it transitively uses, so a schema edit marks exactly the operations that
consume that schema, and refactors that don't change the contract change nothing.

## Full vs. incremental

- **Incremental** is the default — every plan run.
- **Full** happens only on the first run (empty manifest → everything is ADD) or a
  deliberate `templateVersion` bump in docgen.config.json (planner marks every page
  UPDATE with reason "templateVersion bump").

## Try it

```bash
npm run docgen:plan -- --spec docgen/examples/spec-v2.example.json
```

With `examples/manifest.example.json` copied over manifest.json, that spec exercises
all five actions (one endpoint added, one schema-changed, one human-edited, one
removed, one untouched).

## Marking a page human-edited

When someone hand-rewrites generated prose, set `"humanEdited": true` for that page
in manifest.json (same commit). The planner will route future upstream changes for
that page to REVIEW instead of UPDATE.
