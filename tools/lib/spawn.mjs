/**
 * spawnSync wrapper that works with Windows .cmd/.bat shims (scoop/npm
 * installs of ffmpeg, pandoc, …) — those need a shell on win32, and shell
 * mode needs manual quoting so paths with spaces survive cmd.exe.
 */
import {spawnSync} from 'node:child_process';

/**
 * Quote a single argument for cmd.exe shell mode. Pure — exported for tests.
 * Embedded double quotes are escaped as \" and the arg is wrapped in quotes
 * whenever it contains whitespace, a quote, a percent sign, or a cmd
 * metacharacter (&^|<>()); simple args pass through untouched.
 */
export function quoteForCmd(arg) {
  const s = String(arg);
  if (!/[\s"%&^|<>()]/.test(s)) return s;
  return `"${s.replace(/"/g, '\\"')}"`;
}

export function run(cmd, args, opts = {}) {
  if (process.platform !== 'win32') return spawnSync(cmd, args, opts);
  return spawnSync(cmd, args.map(quoteForCmd), {...opts, shell: true});
}
