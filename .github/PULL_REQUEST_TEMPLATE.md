## What changed

<!-- One or two sentences. Link the issue if there is one. -->

## Quality gates (all must pass — CI enforces the same set)

- [ ] `npm run lint:md`
- [ ] `npm run lint:prose`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`

## Checklist

- [ ] New pages start from a template in `templates/`
- [ ] No emojis; Lucide icons only; no hardcoded colors (tokens only)
- [ ] If generated docs were touched: `docgen/manifest.json` updated (or `humanEdited` flagged)
