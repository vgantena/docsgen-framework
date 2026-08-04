---
sidebar_position: 2
title: What you need to supply
description: Every value and decision the framework needs from you, in the order it asks for them.
---

# What you need to supply

The framework generates a help center, but it cannot invent your product. This
page lists everything it needs from you, in the order you meet it, with what
breaks if you skip it.

Collect the first two sections before you start — those are the ones that stall
an adoption halfway through.

## 1. Identity

One command writes all of these into `site.config.ts`:

```bash
npm run init-product -- --name "Acme Suite" --org "Acme Inc." \
  --org-url https://acme.example --app-url http://localhost:3000 \
  --docs-url https://docs.acme.example --tagline "Help center"
```

| Input | Used for | Required |
| --- | --- | --- |
| `--name` | Product name in the navbar, page titles, social card | Yes * |
| `--org` | Footer copyright line | Yes * |
| `--org-url` | Footer "Website" link | Yes * |
| `--app-url` | The running app that screenshots and videos are taken from | Yes * |
| `--docs-url` | Canonical URLs, sitemap, social card links | Yes * |
| `--tagline` | Sits under the product name | No |

Leave `--docs-url` at its placeholder and the build warns you: canonical URLs and
the sitemap would point at `example.com`.

## 2. Credentials

Copy `.env.example` to `.env` (gitignored) and fill it in.

| Variable | Used for | Required |
| --- | --- | --- |
| `APP_URL` | Where capture and record point | Yes * |
| `DEMO_USER` / `DEMO_PASS` | Signing in for authenticated screenshots | Only for gated screens |
| `KB_BASE_URL` | Your platform API root | Only for the KB export |
| `KB_USER` / `KB_PASS` | An account with support-triage rights | Only for `--write` exports |

:::warning
Use seeded demo data, never real customer accounts. Whatever is on screen ends up
committed to a repository, and a screenshot cannot be unpublished.
:::

## 3. How to sign in to your app

Rewrite `tools/flows/login.mjs` — about fifteen lines of Playwright that fill
your login form. It is the only app-specific code in the repo, by design.

Without it, `npm run login` cannot produce `auth.json`, and every screenshot of a
signed-in screen fails.

## 4. The pipeline

In `docgen.config.json`:

| Input | Meaning |
| --- | --- |
| `sources[].repo` | Path to the repo the docs describe, for example `../acme-api` |
| `sources[].extract.spec` | Path to the OpenAPI JSON inside that repo |
| `sources[].output` | Where generated pages land |
| `kb.apiBasePath` | Prefix for the knowledge-base API |
| `kb.components` | **Your product's category vocabulary** |

`kb.components` is the one people underestimate. Every guide page's `category`
frontmatter must match an entry exactly, and the export skips any page that does
not. Take the list from your product's own category list rather than inventing
one.

`npm run doctor` reports sources still pointing at the `../your-api-repo`
placeholders.

## 5. Vocabulary

Add your product name, brand names, and domain terms to
`.vale/styles/config/vocabularies/Docs/accept.txt`, one regex per line, handling
case like `[Ww]ebhooks?`.

Without it the prose gate reports your own product name as a spelling error.

## 6. Per module, as you document it

Each module gets a manifest at `tools/media/<module>.json`:

| Input | Meaning |
| --- | --- |
| `url` | The route to photograph |
| `clicks` | Selectors to click first, for screens the URL alone cannot reach |
| `highlights` | What to ring, and in which colour — `::yellow` fill this in, `::action` press this, `::red` careful |
| `scroll` | Bring a target below the fold into view |
| `videos[].flow` | A Playwright flow file that drives the walkthrough |

These come from **your app's DOM**. Stable `data-testid` attributes are worth
adding to the app for this purpose — `npm run audit:selectors` then verifies
every selector still exists, and tells you before a screenshot silently rots.

## 7. Deployment, if you use the containerised path

Everything in `infra/` ships as an `example.com` placeholder. Replace:

| Input | Where |
| --- | --- |
| Docs hostnames, per environment | `infra/nginx/vps/*.conf` |
| The app origin the auth gate asks | `infra/nginx/vps/*.conf` |
| Container image name | `infra/compose/prod.yml` (`DOCS_IMAGE`) |
| Image labels — vendor, source, licence | `infra/docker/Dockerfile` |
| TLS certificate paths | `infra/nginx/vps/*.conf` |
| IP allowlist for the development edge | `geo $dev_allowed` in `infra/nginx/vps/dev.conf` |

One more lives **outside** this repo: your app must issue its session cookie for
the parent domain (`SESSION_COOKIE_DOMAIN=.acme.example`), or the auth gate sends
every visitor to a login they have already passed.

## 8. Repository settings, if you want the scheduled checks

Media drift detection ships disabled, because a hosted runner cannot reach your
app. Set these to switch it on:

| Setting | Kind | Meaning |
| --- | --- | --- |
| `MEDIA_DRIFT_RUNNER` | Variable | A runner label that can reach your app |
| `APP_URL` | Variable | Where that runner finds it |
| `APP_REPO` | Variable | `owner/name` of the app, for the selector audit |
| `DEMO_USER` / `DEMO_PASS` | Secret | Signing in during the nightly run |
| `APP_REPO_TOKEN` | Secret | Only when the app repo is private |

## 9. Optional

Safe to leave empty — each stays switched off until you fill it in.

| Input | Where | Effect when set |
| --- | --- | --- |
| `repo.url` / `repo.editBase` | `site.config.ts` | Adds "Edit this page" and a footer link |
| `analytics.gtagTrackingId` | `site.config.ts` | Analytics on production builds only |
| `feedback.endpoint` | `site.config.ts` | "Was this page helpful?" under every page |
| `locales` | `site.config.ts` | A language dropdown |
| `announcement` | `site.config.ts` | A dismissible bar across the top |

## Decisions, not values

Four things no default can choose for you:

- **Which modules to document first.** Support volume beats feature order.
- **Your KB category vocabulary** (section 4) — it has to match the product.
- **Whether the framework's own manual ships publicly.** It is author
  documentation; on a customer help center mark those pages `audience: internal`
  and `draft: true`.
- **When to graduate.** Run `npm run drop-sample` once your own content exists,
  and before the first public deploy.

## Checking your work

```bash
npm run doctor
```

It reports missing prerequisites, placeholder values still in place, unresolvable
pipeline sources, and endpoint pages the manifest does not track — each with the
exact command that fixes it. Run it first, and whenever anything misbehaves.
