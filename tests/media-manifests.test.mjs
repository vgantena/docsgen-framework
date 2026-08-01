/**
 * Schema check for the committed media manifests (tools/media/*.json) so a
 * typo'd manifest fails in `npm test` rather than mid-capture. Also enforces
 * the single-frame standard: no per-shot viewport overrides.
 */
import assert from 'node:assert/strict';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';

const MEDIA_DIR = 'tools/media';
const manifests = existsSync(MEDIA_DIR)
  ? readdirSync(MEDIA_DIR).filter((f) => f.endsWith('.json'))
  : [];

const isStrArray = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string' && x.length > 0);

// Manifests are product-specific: a freshly cloned framework (or one reset via
// `init-product --fresh`) legitimately has none, so an empty dir skips rather
// than fails. The point is to catch a typo'd manifest, not to require one.
const skip = manifests.length === 0 ? `no manifests in ${MEDIA_DIR} — nothing to validate` : false;

test('media manifests are well-formed and follow the single-frame standard', {skip}, () => {
  for (const file of manifests) {
    const path = join(MEDIA_DIR, file);
    const m = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(typeof m.module, 'string', `${file}: "module" is required`);

    for (const shot of m.screenshots ?? []) {
      const label = `${file} → ${shot.out}`;
      assert.match(String(shot.out), /^static\/img\/.+\.png$/, `${label}: out must be static/img/**.png`);
      if (shot.url !== undefined) assert.equal(typeof shot.url, 'string', `${label}: url must be a string`);
      if (shot.clicks !== undefined) assert.ok(isStrArray(shot.clicks), `${label}: clicks must be a string array`);
      if (shot.highlights !== undefined) {
        assert.ok(isStrArray(shot.highlights), `${label}: highlights must be a string array`);
        for (const h of shot.highlights) {
          assert.ok(
            !h.includes('::') || /::(red|yellow|action)$/.test(h),
            `${label}: highlight "${h}" has an unknown ::color (red|yellow|action)`,
          );
        }
      }
      if (shot.scroll !== undefined) assert.equal(typeof shot.scroll, 'string', `${label}: scroll must be a string`);
      if (shot.wait !== undefined) assert.equal(typeof shot.wait, 'number', `${label}: wait must be a number`);
      for (const banned of ['preset', 'width', 'height', 'scale']) {
        assert.ok(!(banned in shot), `${label}: "${banned}" is not allowed — all screenshots share the single 1280×800 frame (split tall forms with scroll)`);
      }
    }

    for (const video of m.videos ?? []) {
      const label = `${file} → ${video.out}`;
      assert.match(String(video.out), /^static\/video\/[^.]+$/, `${label}: out must be static/video/<module>/<name> without extension`);
      assert.equal(typeof video.flow, 'string', `${label}: flow is required`);
      assert.ok(existsSync(video.flow), `${label}: flow file ${video.flow} does not exist`);
      if (video.poster !== undefined) assert.equal(typeof video.poster, 'number', `${label}: poster must be a number (seconds)`);
    }
  }
});
