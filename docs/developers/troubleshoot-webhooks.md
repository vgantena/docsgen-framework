---
sidebar_position: 5
title: Troubleshoot webhook deliveries
description: Fixes for the most common webhook problems — signature mismatches, timeouts, duplicates, and failed responses.
---

# Troubleshoot webhook deliveries

This page covers deliveries from [Webhooks](/developers/webhooks) that fail or behave unexpectedly. Symptoms are ordered by how often they occur.

## Signature verification fails on every delivery

**Cause:** the HMAC is computed over a parsed-and-re-serialized body instead of the raw bytes, or the wrong secret is in use.

**Fix:**

<Steps>

1. Read the raw request body **before** any JSON middleware runs, and pass those exact bytes to the [verification function](/developers/webhooks#verify-signatures).

2. Confirm the secret matches the one shown for this endpoint in **Settings** → **Webhooks** — each endpoint has its own secret.

3. Compare against the `X-Signature` header value with a constant-time comparison, not string equality.

</Steps>

## Deliveries time out even though the endpoint works

**Cause:** the endpoint does its processing before responding, and the work takes longer than the 10-second response deadline.

**Fix:** acknowledge first, process later — return `2xx` as soon as the signature checks out, queue the event, and do the real work asynchronously.

## The same event arrives more than once

**Cause:** deliveries are at-least-once by design — retries after a timeout can produce duplicates even when your endpoint received the original.

**Fix:** deduplicate on the event `id` (`evt_…`). Store processed ids and skip any id you've already seen; the [retry schedule](/developers/webhooks#retries) stops once your endpoint returns `2xx`.

## Deliveries stop after a run of failures

**Cause:** the endpoint kept returning a non-`2xx` status (or redirects), so every attempt in the 24-hour retry window failed and the events expired.

**Fix:**

<Steps>

1. Check your endpoint's logs for the failing status — `3xx` responses count as failures, so `POST` to the final URL directly.

2. Fix the underlying error and confirm the endpoint returns `2xx` within 10 seconds.

3. Re-sync the state you missed: expired events aren't re-sent, so [list projects](/developers/projects-api/list-projects) to catch up, then resume processing new deliveries.

</Steps>

:::info
If none of these fixes work, contact support and include your workspace ID and a failing event `id`.
:::
