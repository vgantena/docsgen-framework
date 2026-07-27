/**
 * Example recording flow — replace with a real product workflow.
 * Drive the page like a user: click, type, wait for what the user would see.
 * Keep clips 15–60 seconds; pace actions with short waits so viewers can follow.
 */
export default async function flow(page, {baseUrl}) {
  await page.goto(baseUrl, {waitUntil: 'networkidle'});
  await page.waitForTimeout(800);

  // Example pacing: scroll through the page like a reader.
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(900);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(900);

  // Real flows click through the product, e.g.:
  // await page.getByRole('button', {name: 'New project'}).click();
  // await page.getByLabel('Project name').fill('Quarterly report');
  // await page.getByRole('button', {name: 'Create'}).click();
  // await page.getByText('Project created').waitFor();
  await page.waitForTimeout(600);
}
