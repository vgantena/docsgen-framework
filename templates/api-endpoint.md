---
sidebar_position: 99
title: Verb + object (for example "Create a project")
description: METHOD /v1/path — one-line purpose.
category: Items          # KB component this page belongs to (Items, POS, Sale Invoices, …)
keywords: [create item api, item endpoint, POST items]   # what developers actually type when searching — include synonyms (create/add, item/product)
audience: vendor         # vendor | internal — controls KB visibility
---

# Verb + object

<ApiEndpoint method="GET" path="/v1/resource/{id}">One-line summary shown beside the path.</ApiEndpoint>

<Badge variant="info">Minimum role</Badge> <Badge variant="new">Plan availability</Badge>

## Overview

Two or three sentences: what the endpoint does, when to use it, and notable side effects (webhook events, cascades).

## Request

### Path parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes * | … |

### Query parameters (omit section if none)

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| … | … | No | … |

### Body parameters (omit section if none)

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| … | … | Yes * | … |

### Headers (omit section unless the endpoint has notable headers — `Content-Type` when it sends a body, `Idempotency-Key`, …)

| Header | Value |
| --- | --- |
| `Content-Type` | `application/json` |

### Sample request

Use `groupId="lang"` so the reader's language choice syncs across every page. For endpoints with a body, lead with a JSON tab showing the raw payload.

<Tabs groupId="lang">
<TabItem value="json" label="JSON">

```json
{}
```

</TabItem>
<TabItem value="curl" label="curl">

```bash
curl …
```

</TabItem>
<TabItem value="java" label="Java">

```java
// java.net.http sample
```

</TabItem>
<TabItem value="python" label="Python">

```python
# requests sample
```

</TabItem>
<TabItem value="js" label="JavaScript">

```javascript
// fetch sample
```

</TabItem>
</Tabs>

## Response

`200 OK` — describe the shape, link to the shared object definition:

```json
{}
```

| Field | Type | Description |
| --- | --- | --- |
| … | … | … |

## Status and error codes

List every status this endpoint can return, with the machine-readable `code`:

| Status | Code | When |
| --- | --- | --- |
| `200` | — | Success. |
| `401` | `unauthenticated` | … |
| `5xx` | `server_error` | Server problem — retry with exponential backoff. |

## Business rules

Bullet the constraints that live outside the schema: role/plan gates, uniqueness rules, limits, idempotency behavior, webhook side effects, retention.

## Related

Two or three links: sibling endpoints, authentication, or the concept/lifecycle the endpoint touches.

- [Sibling endpoint](/developers/resource-api/verb-object) — why the reader would go there
