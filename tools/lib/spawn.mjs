/**
 * spawnSync wrapper that works with Windows .cmd/.bat shims (scoop/npm
 * installs of ffmpeg, pandoc, …) — those need a shell on win32, and shell
 * mode needs manual quoting so paths with spaces survive cmd.exe.
 */
import {spawnSync} from 'node:child_process';

export function run(cmd, args, opts = {}) {
  if (process.platform !== 'win32') return spawnSync(cmd, args, opts);
  const quoted = args.map((a) => (/[\s&^|<>()]/.test(a) ? `"${a}"` : a));
  return spawnSync(cmd, quoted, {...opts, shell: true});
}
