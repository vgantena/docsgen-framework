/**
 * Training-video flow: tour from the help-center home to a finished guide.
 * Drives the DOCS SITE itself, so pass the docs server as the base:
 *
 *   npm run record -- --flow tools/flows/getting-started-tour.mjs \
 *     --out static/video/getting-started-tour --base http://localhost:3300
 */
export default async function flow(page, {baseUrl}) {
  await page.goto(baseUrl, {waitUntil: 'networkidle'});
  await page.waitForTimeout(1200);

  // Open the Getting started guide from the card grid.
  await page.getByRole('link', {name: /Getting started Set up your account/}).click();
  await page.waitForTimeout(1400);

  // Read through the steps like a viewer would.
  await page.mouse.wheel(0, 350);
  await page.waitForTimeout(1100);
  await page.mouse.wheel(0, 350);
  await page.waitForTimeout(1100);

  // Expand a troubleshooting item.
  await page.getByText("I didn't receive the invitation email").click();
  await page.waitForTimeout(1400);

  // Follow the related link to the next guide.
  await page.getByRole('link', {name: 'Managing projects'}).last().click();
  await page.waitForTimeout(1200);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(1200);
}
