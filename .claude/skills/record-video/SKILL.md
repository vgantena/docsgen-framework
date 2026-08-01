---
name: record-video
description: Record a training-quality product workflow video (Playwright flow → mp4 + poster, highlighted clicks, no login shown) and embed it with the Video component.
---

# Record and embed a docs video

## Training-video rules (non-negotiable)

- **Never show the login screen.** Run `npm run login` once (reads `APP_URL` + `DEMO_USER`/`DEMO_PASS` from `.env`, saves `auth.json`), then record with `--storage-state auth.json`. Every video starts at the Dashboard.
- **Every interaction must be visible.** Use the `ui` helper: `ui.click(sel)` outlines the target, pauses so the viewer can find it, then clicks (a pulse ring renders automatically on every real click); `ui.fill(sel, value)` outlines the field in yellow while filling; `ui.spotlight(sel)` draws attention without interacting. Colors come from the `--doc-frame-highlight*` tokens.
- Only seeded demo data on screen — never real customer data. Name files `verb-object`.

## Steps

1. Write a flow in `tools/flows/<name>.mjs` — default-export `async (page, {baseUrl, ui}) => {…}` driving the product like a user:

   ```js
   export default async function flow(page, {baseUrl, ui}) {
     await page.goto(baseUrl, {waitUntil: 'networkidle'}); // already signed in
     await ui.click('[data-testid="sidebar-group-inventory"]');
     await ui.click('[data-testid="sidebar-nav-items"]');
     await ui.fill('[data-testid="item-search"]', 'fan');
     await ui.spotlight('[data-testid="item-filter-low-stock"]');
   }
   ```

   Keep clips 15–60 s. For controlled inputs that drop keystrokes, `ui.fill` is already atomic. See `tools/flows/items-tour.mjs`.

2. Record against the running app (`appUrl` from site.config.ts, or `--base` to override):

   ```powershell
   npm run login   # once per session — creates auth.json (gitignored)
   npm run record -- --flow tools/flows/<name>.mjs --out static/video/<section>/<name> --storage-state auth.json
   ```

   Output: `<name>.mp4` (H.264, faststart) **and** `<name>.jpg` poster (frame at 1.5 s; override with `--poster <seconds>`). ffmpeg must be on PATH — refresh with the PATH snippet in CLAUDE.md if it reports missing.

3. Embed with the poster so the paused player never shows a blank frame:

   ```jsx
   <Video
     src="/video/<section>/<name>.mp4"
     poster="/video/<section>/<name>.jpg"
     caption="What the viewer sees (duration)."
     frame="browser"
   />
   ```

   Options: `autoPlay` (silent GIF-style loop), `startAt={n}`, `playbackRate={1.25}`, `controls={false}`, `width={480}`.

4. **Video or carousel?** A video earns its weight when *motion* teaches (navigation paths, drag, live feedback). A fixed sequence of states teaches better — and loads lighter — as a `<Carousel slides={[{src, alt, caption}, …]} />` of highlighted screenshots. Prefer one video per page maximum; carousels for the rest.
