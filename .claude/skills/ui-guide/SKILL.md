---
name: ui-guide
description: Produce a training-center-quality user guide for one app module — highlighted screenshots, carousels, walkthrough videos, KB frontmatter. Use when documenting any UI module or screen end to end.
---

# Document a UI module as a training center

One module = one folder `docs/guides/<module>/` with an overview page (`index.md`) plus one task page per job the user does there. The result must work three ways: read as docs, followed as training, and retrieved as KB answers by the AI support assistant.

## 1. Scope the module first

Read the module's source (screen component + shared list controller) and list: every toolbar action, filter, row action, modal, empty state, and error state. Each *task* a user performs becomes a task page (from `templates/task.md`); the screen itself becomes the overview.

## 2. Media plan — before writing prose

Authenticate once: `npm run login` (never capture or record a login screen).

| Teaching need | Medium | Command |
| --- | --- | --- |
| Where things are on a screen | Screenshot, no highlight | `npm run capture -- --url / --storage-state auth.json --click "[data-testid=…]" --out static/img/<module>/<verb-object>.png` |
| Which control to press | Screenshot + `--highlight "sel::action"` | action = blue "press this" |
| What to fill in | Screenshot + `--highlight "sel::yellow"` (repeatable — one per field) | yellow = fill these |
| Destructive / careful | Screenshot + `--highlight "sel::red"` | red = pay attention |
| A fixed sequence of states | `<Carousel slides={[…]} />` of the above | lighter than video, user-paced |
| Motion itself (navigation, feedback) | `<Video>` via the record-video skill (`ui.click`/`ui.fill` helpers, `--storage-state`) | max one per page |

Screenshots reach state-routed screens with repeatable `--click`; every screenshot is 2× scale through `npm run capture` — never ad-hoc tools.

**One standard frame, no exceptions: 1280×800 (2560×1600 output).** Every screenshot uses the default frame — mixed heights make carousels and page flow jump. A form taller than the frame is never captured taller; split it into one section shot per step (basic fields → pricing → save button), each framed with `--scroll "<selector>"` to center that section. Never pass `--width`/`--height` for docs media.

**Commit the recipe, not just the pixels.** Every module keeps a manifest at `tools/media/<module>.json` listing how each screenshot (url, clicks, highlights, preset) and video (flow, poster) is produced. Produce media by editing the manifest and running:

```powershell
npm run media -- --manifest tools/media/<module>.json            # everything
npm run media -- --manifest tools/media/<module>.json --only screenshots
npm run media -- --manifest tools/media/<module>.json --filter add-item
```

After any UI change, one command re-shoots the module identically. Caveat: video flows drive the real app and can create records — re-record only against demo data and clean up what the flow created.

## 3. Page structure (every task page)

Frontmatter: `title`, `description`, `sidebar_position`, **`category`** (KB component), **`keywords`** (the words users type, with synonyms), **`audience`** (vendor | internal). Body: intro → Before you begin → `<Steps>` (each step self-contained in text; media illustrates, text carries the meaning; bold UI names) → Verify → Troubleshooting (`<Expandable>` per real symptom) → Related (sibling pages + matching API pages).

## 4. Gate it

`lint:md`, `lint:prose`, `typecheck`, `build` (broken links), plus: every referenced media file exists (`grep` the `/img/` + `/video/` paths), every image has full alt text, no step says "as shown below".
