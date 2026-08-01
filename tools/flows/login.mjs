/**
 * App-specific login flow for `npm run login` — REWRITE THIS FOR YOUR APP.
 * This is the only app-specific code in the framework, by design: it signs in
 * and waits for a signed-in marker so capture/record can reuse `auth.json`.
 * Credentials come from DEMO_USER / DEMO_PASS (.env); never hardcode them.
 *
 * Replace the selectors below with your own. Prefer `data-testid` attributes
 * over CSS or text selectors — `npm run audit:selectors` can then verify they
 * still exist in your app's source.
 */
export default async function flow(page, {baseUrl}) {
  const user = process.env.DEMO_USER;
  const pass = process.env.DEMO_PASS;
  if (!user || !pass) throw new Error('Set DEMO_USER and DEMO_PASS (see .env.example).');

  await page.goto(baseUrl, {waitUntil: 'networkidle'});
  await page.locator('[data-testid="login-username"]').fill(user);
  await page.locator('[data-testid="login-password"]').fill(pass);
  await page.locator('[data-testid="login-submit"]').click();
  // Wait for something that only renders once signed in.
  await page.locator('[data-testid="app-shell"]').waitFor({state: 'visible', timeout: 30_000});
}
