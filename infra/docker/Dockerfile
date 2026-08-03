# Docs site — static site image (Docusaurus build → nginx).
# Build context = repo root.
#
# Build once, promote the digest: the image tested on Dev is the exact digest
# shipped to PROD, mirroring the app repo's rule. That is only possible because
# the canonical URL is NOT baked per environment — see infra/nginx/vps/dev.conf
# for why Dev serves the prod canonical plus a noindex header instead.

FROM node:22-alpine AS build
WORKDIR /repo

# Dependencies first so a content-only commit reuses the install layer. This
# repo is npm + package-lock.json (NOT the app repo's pnpm) — `npm ci` is what
# makes the lockfile authoritative.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# `docusaurus build` is also the broken-link check — it fails the build on a
# dead internal link, so a bad cross-reference cannot reach an environment.
RUN npm run build

FROM nginx:1.27-alpine AS run
ARG VERSION=0.0.0-dev
ARG REVISION=unknown
ARG CREATED=unknown
# Replace these with your own org, repo and licence before publishing.
LABEL org.opencontainers.image.vendor="Your Org" \
      org.opencontainers.image.title="docs-site" \
      org.opencontainers.image.description="Product and API documentation" \
      org.opencontainers.image.source="https://github.com/your-org/your-docs-repo" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.created="${CREATED}"

COPY --from=build /repo/build /usr/share/nginx/html
COPY infra/nginx/site.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1
