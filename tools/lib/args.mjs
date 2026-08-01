/**
 * Shared CLI argument parser — replaces the hand-copied parse loop in every
 * tool so the edge cases are fixed (and tested) once.
 *
 * Rules:
 * - `--key value` and `--key=value` both work.
 * - A token starting with `--` is NEVER consumed as a value — `--tagline --x`
 *   leaves tagline flag-only (true) instead of silently swallowing `--x`.
 *   Values that legitimately start with `--` must use the `=` form.
 * - Keys listed in `multi` collect every occurrence into an array; other keys
 *   are scalars where the last occurrence wins.
 *
 *   const {args, lists} = parseArgs(process.argv.slice(2), {multi: ['click']});
 *   const clicks = lists.click;            // always an array
 *   const width = num(args, 'width', 1280); // validated numeric flag
 */

export function parseArgs(argv, {multi = []} = {}) {
  const args = {};
  const lists = Object.fromEntries(multi.map((k) => [k, []]));
  const isMulti = new Set(multi);
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    let key = token.slice(2);
    let value;
    const eq = key.indexOf('=');
    if (eq !== -1) {
      value = key.slice(eq + 1);
      key = key.slice(0, eq);
    } else {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        value = next;
        i++;
      }
    }
    if (isMulti.has(key)) {
      if (value !== undefined) lists[key].push(value);
    } else {
      args[key] = value !== undefined ? value : true;
    }
  }
  return {args, lists};
}

/** String flag value or undefined (flag-only `--x` returns undefined). */
export function str(args, name) {
  const v = args[name];
  return typeof v === 'string' ? v : undefined;
}

/**
 * Numeric flag with validation — `--width` with a missing or non-numeric value
 * exits with a clear message instead of producing NaN or a 1-pixel viewport.
 */
export function num(args, name, fallback) {
  const v = args[name];
  if (v === undefined) return fallback;
  const n = Number(v);
  if (typeof v !== 'string' || v.trim() === '' || Number.isNaN(n)) {
    console.error(`--${name} needs a numeric value (got ${v === true ? 'no value' : JSON.stringify(v)}), e.g. --${name} ${fallback}`);
    process.exit(1);
  }
  return n;
}
