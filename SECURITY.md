# Security policy

## Supported versions

This is a **template repository**: you adopt it by taking a copy, and from then
on you own that copy. There is no published package to patch, so fixes land on
`main` and reach you when you pull them into your fork.

Only the latest `main` is maintained.

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Report it privately through
[GitHub Security Advisories](https://github.com/vgantena/docsgen-framework/security/advisories/new),
or by email to vgantena@gmail.com.

Please include what you can: the affected file or command, what an attacker
could do with it, and the steps to reproduce. You will get an acknowledgement
within 7 days, and an assessment within 30.

## What is in scope

This project is a static-site generator plus local tooling — it has no server,
no user accounts, and no database. Realistic issues look like:

- **Command injection** in the tooling — anything that reaches a shell through
  `tools/lib/spawn.mjs`, `npm run capture`, `npm run record`, or the media
  pipeline.
- **Credential leakage** — the KB export and the recording flows read
  `KB_USER`/`KB_PASS` and `DEMO_USER`/`DEMO_PASS` from `.env`. Anything that
  writes those into a committed file, a screenshot, a video, or a log is a
  vulnerability, not a bug.
- **`auth.json`** — `npm run login` writes real session cookies to it. It is
  gitignored; anything that defeats that is in scope.
- A dependency vulnerability that is actually reachable from this code.

## What is out of scope

- Vulnerabilities in a product you documented with this framework.
- Dependency advisories with no reachable path from this code — open a normal
  issue or let Dependabot handle it.
- Anything requiring an attacker to already have write access to your repo or
  your workstation.

## A note on the screenshot and video pipeline

`npm run capture` and `npm run record` drive a **real browser against a real
application** using real credentials. Point them at demo data, never at
production with customer records: whatever is on screen is committed to a public
repository and cannot be unpublished. Recording flows are also told never to film
the login screen, for the same reason.
