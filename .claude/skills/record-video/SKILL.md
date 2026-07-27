---
name: record-video
description: Record a product workflow video for the docs (Playwright flow → mp4 + poster) and embed it with the Video component.
---

# Record and embed a docs video

## Steps

1. Write a flow in `tools/flows/<name>.mjs` — default-export `async (page, {baseUrl}) => {…}` driving the product like a user. Pace actions with 800–1400 ms waits; keep clips 15–60 s. See `tools/flows/getting-started-tour.mjs`.
2. Record against the running app (`appUrl` from site.config.ts, or `--base` to override):

   ```powershell
   npm run record -- --flow tools/flows/<name>.mjs --out static/video/<section>/<name>
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

4. Only seeded demo data on screen — never real customer data. Name files `verb-object`.
