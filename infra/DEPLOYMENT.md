# Deploying Docs site

This repo owns its own deployment. It is a **service in the product stack**, but
it ships from here rather than from the application repo so that screenshots and
screen recordings never enter the application repo's history.

> **Template.** Every hostname below is a placeholder — `docs.example.com`,
> `docs.example.dev`, `app.example.com`. Replace them with your own before the
> first deploy, along with the image name in `compose/prod.yml`, the OCI labels
> in `docker/Dockerfile`, and the TLS paths in `nginx/vps/*.conf`. Nothing here
> reads them from `site.config.ts`: nginx has no access to it.

```
localhost              Dev                        PROD
http://docs.localhost  https://docs.example.dev https://docs.example.com
```

## Layout

```
.github/workflows/image.yml    build + smoke-test (PR), publish (develop), promote (main)
infra/docker/Dockerfile        Docusaurus build → nginx static image
infra/nginx/site.conf          the server INSIDE the image (files only)
infra/nginx/edge-localhost.conf  http://docs.localhost, ungated
infra/nginx/auth-gate.conf     the "registered users only" snippet
infra/nginx/vps/dev.conf       docs.example.dev  (IP-allowlisted + noindex)
infra/nginx/vps/prod.conf      docs.example.com
infra/compose/dev.yml          localhost: build from source
infra/compose/prod.yml         Dev VPS + PROD VPS: pull a promoted digest
```

Host routing, TLS and access control are all at the **edge**. The image only
knows how to serve files, which is what lets one digest run in every
environment.

## Localhost

```bash
npm start                                                   # authoring, live reload
docker compose -f infra/compose/dev.yml up -d --build       # the real artifact
curl -s localhost/healthz                                   # → ok
```

Use `npm start` to write. Use the container to verify what actually ships —
cache headers, 404 handling, the edge. The container does not hot-reload.

`docs.localhost` is **ungated**: writing documentation should not require a
running app, a database and a valid session.

⚠ The app stack's edge also binds `:80`. Run one or the other, or remap the
port in `infra/compose/dev.yml`.

## Dev and PROD

Build once, promote the digest — the image verified on Dev is the exact image
that serves PROD. The environments differ by `EDGE_CONF` and the cert mount,
never by the image.

### The branch lane

Same model as the app repo: **`feature/*` → `develop` → `main`.**

| branch | CI does | you deploy |
|---|---|---|
| `feature/*` (PR) | build + smoke-test, never publishes | — |
| `develop` | **builds** and pushes `:<sha>` + `:develop` | Dev VPS |
| `main` | **promotes** — retags that digest as `:main`, no rebuild | live |

⚠ **`main` must be FAST-FORWARDED from `develop`, never squash-merged.** The
promote job finds the image by commit sha; a squash or merge commit invents a
new sha that develop never built, and the job fails rather than promote
nothing. Fast-forward is what makes "the image Dev verified is the image that
ships" literally true instead of merely likely.

```bash
git checkout main && git merge --ff-only develop && git push origin main
```

The rebuild is skipped on purpose: the Dockerfile starts from `node:22-alpine`
and `nginx:1.27-alpine`, both *moving* tags, so rebuilding the same commit
later can pull a patched base and produce different bytes.

So `$SHA` below is the develop commit you want to ship — take it from the
workflow run summary, which prints the deploy line ready to paste.

```bash
# Dev VPS
DOCS_IMAGE=$DOCS_IMAGE DOCS_IMAGE_TAG=$SHA EDGE_CONF=vps/dev.conf \
  docker compose -f infra/compose/prod.yml up -d

# PROD VPS — same $SHA that was verified on Dev
DOCS_IMAGE=$DOCS_IMAGE DOCS_IMAGE_TAG=$SHA EDGE_CONF=vps/prod.conf \
  docker compose -f infra/compose/prod.yml up -d
```

`DOCS_IMAGE_TAG` has no default on purpose: a `:latest` would mean the
thing verified on Dev and the thing serving PROD are only *probably* the same.

This is a **separate tag** from the app stack's `APP_IMAGE_TAG`. The stack is
now two promoted artifacts, each still promoted by digest.

## Prerequisites

**DNS** — `docs.example.dev` and `docs.example.com` → the respective VPS.

**TLS** — the wildcard certs the app stack already uses
(`/etc/letsencrypt/live/example.{dev,com}/`). Keeping every hostname a single
label is what makes one wildcard per environment enough.
`.dev` is HSTS-preloaded, so Dev needs a valid cert from day one — browsers
refuse plain HTTP there outright.

**Dev IP allowlist** — add your IPs to the `geo $dev_allowed` block in
`infra/nginx/vps/dev.conf` before the first deploy, or Dev answers 403.

**The auth gate needs the app to share its cookie.** See below.

## The "registered users only" gate

Dev and PROD `include` `auth-gate.conf`; nginx asks the app's server whether the
caller's session is valid (`/api/auth/verify` → 200/401) before serving. The
docs site has no auth code, no user table and no session — it only asks. That is
why the gate is at the edge: Docusaurus is a static export and cannot do this.

**Required in the app's `.env`, or the site is unreachable:**

```
SESSION_COOKIE_DOMAIN=.example.com     # PROD
SESSION_COOKIE_DOMAIN=.example.dev     # Dev
```

The app issues a **host-only** cookie by default, which only
`app.example.com` receives. Without this, every request to docs arrives
anonymous and users bounce to the login forever — a redirect loop, not a
readable error. It is the first thing to check if the gate "doesn't work".

Each environment verifies against its **own** app (`$app_origin`). Never point a
lower environment at a higher one, or a Dev session unlocks PROD docs.

`/healthz` stays reachable without a session, so monitoring does not report the
site down whenever auth has a bad day.

**To publish the docs publicly**, delete the `auth_request` line in
`auth-gate.conf`. Nothing else depends on it.

## Why Dev serves the PROD canonical URL

Docusaurus bakes `url` into every canonical tag, sitemap entry and absolute link
**at build time**. Building per environment would break build-once-promote.

So the canonical stays the prod URL everywhere, and Dev is kept out of search by
`X-Robots-Tag: noindex, nofollow` at its edge. This is also correct SEO: a
staging copy should point search engines at the real page, never compete with
it.

## Rollback

Re-deploy the previous digest — the image is immutable and carries no state:

```bash
DOCS_IMAGE=$DOCS_IMAGE DOCS_IMAGE_TAG=<previous-sha> EDGE_CONF=vps/prod.conf \
  docker compose -f infra/compose/prod.yml up -d
```

## Verify

```bash
curl -sI https://docs.example.com/healthz            # 200
curl -sI https://docs.example.com/                   # 302 → app login when signed out
curl -sI https://docs.example.dev/ | grep -i robots  # X-Robots-Tag: noindex
```
