# Contributing

Thanks for helping. Issues and pull requests are both welcome, and participation
is covered by the [Code of Conduct](CODE_OF_CONDUCT.md). Security problems go
through [SECURITY.md](SECURITY.md), never a public issue.

## Does it belong here?

This is a **clone-and-own template**: people take a copy and edit it. So the
first question on any change is which side of the line it falls on.

- **Belongs in the framework** — anything product-agnostic: a tool, a component,
  a gate, a standard, a bug in the pipeline.
- **Belongs in your own copy** — anything specific to the product you are
  documenting: its guides, its screenshots, its vocabulary, its deploy hostnames.

If a change only makes sense for one product, it is not a framework change.
Everything product-specific is config, content, or a swappable flow file.

## Ground rules

- Read [CLAUDE.md](CLAUDE.md) first — it is the canonical rulebook for commands, architecture, and the design/content standards. Humans and AI assistants follow the same rules.
- New pages start from a template in [templates/](templates/). API endpoints get one page each (`templates/api-endpoint.md`).
- No emojis; Lucide icons only. No hardcoded colors/sizes; add tokens in `src/css/tokens.css`.
- Never commit credentials, `auth.json`, or screenshots of real customer data. The media tooling drives a real browser against a real app — point it at demo data.

## Workflow

1. Branch from `develop` (`feature/…`). `develop` is the integration branch;
   `main` is the promoted lane and only ever fast-forwards from it.
2. Make your change; keep generated regions and `docgen/manifest.json` in sync if you touch generated docs (see [docgen/README.md](docgen/README.md)).
3. Run the quality gates — all six must pass:

   ```bash
   npm run lint:md
   npm run lint:prose   # needs the vale binary + `vale sync` once
   npm run lint:js
   npm run typecheck
   npm test
   npm run build        # also the broken-link check
   ```

4. Open a PR against `develop`. CI runs the same gates; the PR template includes them as a checklist.

## Licensing of contributions

By submitting a contribution you agree to license it under the same terms as the
project: [MIT](LICENSE) for code, and [CC BY 4.0](LICENSE-docs) for documentation
content and media. There is no CLA to sign.

## Releasing the framework

There is no npm package — the framework is distributed as a template repository,
so a release is a git tag. Bump `version` in package.json (semver), add a
[CHANGELOG.md](CHANGELOG.md) entry, fast-forward `main` from `develop`, then tag
`main` and publish a GitHub release pointing at the changelog entry.

Bump `templateVersion` in `docgen.config.json` only when the page
templates/standards change — it marks every generated page stale on purpose.
