# Contributing

## Ground rules

- Read [CLAUDE.md](CLAUDE.md) first — it is the canonical rulebook for commands, architecture, and the design/content standards. Humans and AI assistants follow the same rules.
- New pages start from a template in [templates/](templates/). API endpoints get one page each (`templates/api-endpoint.md`).
- No emojis; Lucide icons only. No hardcoded colors/sizes; add tokens in `src/css/tokens.css`.

## Workflow

1. Branch from `main`.
2. Make your change; keep generated regions and `docgen/manifest.json` in sync if you touch generated docs (see [docgen/README.md](docgen/README.md)).
3. Run the quality gates — all must pass:

   ```bash
   npm run lint:md
   npm run lint:prose   # needs the vale binary + `vale sync` once
   npm run typecheck
   npm test
   npm run build        # also the broken-link check
   ```

4. Open a PR. CI runs the same gates; the PR template includes them as a checklist.

## Releasing the framework

Bump `version` in package.json (semver), add a [CHANGELOG.md](CHANGELOG.md) entry, and tag. Bump `templateVersion` in `docgen.config.json` only when the page templates/standards change — it marks every generated page stale on purpose.
