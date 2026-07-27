---
sidebar_position: 1
title: Developer guide
description: Base URL, request conventions, versioning, rate limits, and errors for the REST API.
---

# Developer guide

Integrate your systems with the product through the REST API. This section covers everything a developer needs — replace the placeholder host and limits with your product's real values.

## Base URL

All API requests use the same host and version prefix:

```text
https://api.example.com/v1
```

- Requests and responses are JSON (`Content-Type: application/json`).
- All endpoints require [authentication](/developers/authentication).
- Timestamps are ISO 8601 in UTC, for example `2026-07-26T09:30:00Z`.

## Versioning

The API version is part of the path (`/v1`). Backwards-compatible changes — new fields, new endpoints — ship without a version bump. Breaking changes get a new version with a migration period.

## Rate limits

<Badge variant="info">Info</Badge> Default limits per API key:

| Plan | Requests per minute | Burst |
| --- | --- | --- |
| Free | 60 | 100 |
| Pro | 600 | 1,000 |
| Enterprise | Custom | Custom |

Every response includes `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers. When the limit is hit, the API returns `429 Too Many Requests` — back off until the reset time.

## Errors

Errors use conventional HTTP status codes with a consistent JSON body:

```json
{
  "error": {
    "code": "resource_not_found",
    "message": "No project exists with id proj_9X2.",
    "request_id": "req_b7f3d2"
  }
}
```

| Status | Meaning |
| --- | --- |
| `400` | Malformed request — check the message for the offending field. |
| `401` | Missing or invalid API key. |
| `403` | Key is valid but lacks permission for this resource. |
| `404` | Resource doesn't exist. |
| `409` | Conflict with existing state, for example a duplicate name. |
| `422` | Request is valid but a plan limit blocks it. |
| `429` | Rate limit exceeded. |
| `5xx` | Server problem — retry with exponential backoff. |

Two conventions to know: `400` uses `invalid_parameter` for query-string problems and `validation_failed` for body problems, and `403` uses `access_denied` when the caller isn't a member of the resource versus `insufficient_role` when their role is too low.

Include the `request_id` when contacting support about an API problem.

## Next steps

<CardGrid>
  <Card title="Authentication" icon="key" href="/developers/authentication">
    Create an API key and make your first authenticated request.
  </Card>
  <Card title="Projects API" icon="folder" href="/developers/projects-api/">
    Per-endpoint reference: schemas, samples in four languages, error codes, business rules.
  </Card>
  <Card title="Webhooks" icon="bell" href="/developers/webhooks">
    Receive events in your systems the moment they happen.
  </Card>
</CardGrid>
