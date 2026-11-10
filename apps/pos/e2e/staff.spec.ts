import { expect, test } from '@playwright/test';
import { ownerSignIn, pinIn, shot } from './helpers.ts';

// Needs the local stack with the demo seed: pnpm db:start (or db:reset).
// Adds a new staff member and tablet each run, so it can run again and again.

test('the owner adds staff, pairs a tablet with a code, and revokes it', async ({
  page,
  browser,
}, info) => {
  test.skip(
    info.project.name !== 'desktop',
    'one run is enough; the tablet runs in its own browser below',
  );
  const stamp = Date.now().toString(36).slice(-4).toUpperCase();
  const name = `Neha Rao ${stamp}`;

  // Owner, on a laptop: add a cashier with a PIN.
  await ownerSignIn(page);
  await page.getByRole('link', { name: /Staff & devices/ }).click();
  await page.getByRole('button', { name: 'Add staff' }).click();
  const editor = page.getByRole('dialog', { name: 'Add staff' });
  await editor.getByLabel('Name').fill(name);
  await editor.getByLabel('Mobile (optional)').fill('98260 54321');
  await editor.getByRole('checkbox', { name: /Arera Colony/ }).check();
  await editor.getByLabel('PIN').fill('1234');
  await editor.getByRole('button', { name: 'Add staff' }).click();
  await expect(editor.getByText(/Use 4 digits that aren.t all the same or in a row/)).toBeVisible();
  await editor.getByLabel('PIN').fill('4826');
  await page.screenshot({ path: shot('staff-editor', info.project.name) });
  await editor.getByRole('button', { name: 'Add staff' }).click();
  await expect(page.getByText('Staff added', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(name) })).toContainText('PIN set');
  await page.screenshot({ path: shot('staff', info.project.name), fullPage: true });

  // A one-time code for a new tablet at Arera Colony.
  await page.getByRole('tab', { name: 'Counter tablets' }).click();
  await page.getByRole('button', { name: 'Add a counter tablet' }).click();
  await page.getByLabel('Tablet name').fill(`Counter ${stamp}`);
  await page.getByRole('button', { name: 'Get a code' }).click();
  const codeText = page.getByLabel(/^Pairing code /);
  await expect(codeText).toBeVisible();
  const code = (await codeText.textContent()) ?? '';
  expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  await page.screenshot({ path: shot('pair-code', info.project.name) });
  await page.getByRole('button', { name: 'Done' }).click();

  // The tablet, in its own browser: types the code, no password.
  const tabletContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    hasTouch: true,
  });
  const tablet = await tabletContext.newPage();
  await tablet.goto('/login');
  await tablet
    .getByRole('link', { name: 'Setting up a counter tablet? Use a pairing code' })
    .click();
  await tablet.getByLabel('Pairing code').fill(code.toLowerCase());
  await tablet.screenshot({ path: shot('pair-tablet', info.project.name) });
  await tablet.getByRole('button', { name: 'Set up tablet' }).click();
  await expect(tablet).toHaveURL(/\/pin$/);

  // The new cashier signs in there with her PIN.
  await pinIn(tablet, name, '4826');
  await expect(tablet.getByRole('button', { name: 'Lock' })).toBeVisible();

  // Back on the laptop: the tablet is listed; revoke it.
  await page.reload();
  await page.getByRole('tab', { name: 'Counter tablets' }).click();
  const row = page
    .getByRole('region', { name: 'Arera Colony' })
    .getByRole('listitem')
    .filter({ hasText: `Counter ${stamp}` });
  await expect(row).toContainText('Shared counter tablet');
  await row.getByRole('button', { name: 'Revoke' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Revoke' }).click();
  await expect(row).toContainText('Revoked');

  // The tablet stops working.
  await tablet.getByRole('button', { name: 'Lock' }).click();
  await expect(tablet.getByRole('heading', { name: 'This tablet was removed' })).toBeVisible();
  await tabletContext.close();
});
