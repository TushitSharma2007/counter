import { expect, test } from '@playwright/test';
import { ownerSignIn, shot } from './helpers.ts';

// Needs the local stack with the demo seed: pnpm db:start (or db:reset).

test('the owner bills from their own phone at whichever outlet they are at', async ({
  page,
}, info) => {
  const project = info.project.name;
  await ownerSignIn(page);

  // Owners see every outlet.
  for (const name of ['Arera Colony', 'MP Nagar', 'New Market']) {
    await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible();
  }
  await page.screenshot({ path: shot('owner-outlets', project) });

  // At Arera Colony: the same billing screen, as the owner, with this phone's own counter code.
  await page.getByRole('link', { name: /Arera Colony/ }).click();
  await expect(page.getByRole('button', { name: 'Outlets' })).toBeVisible();
  const banner = page.getByRole('banner');
  await expect(banner).toContainText(/Arera Colony · T\d+/);
  const areraCode = /Arera Colony · T\d+/.exec((await banner.textContent()) ?? '')?.[0] ?? '';

  if (project === 'phone') {
    await page.getByRole('button', { name: 'Add Veg Puff', exact: true }).click();
  } else {
    await page.getByRole('button', { name: /^Veg Puff,/ }).click();
  }
  await page.screenshot({ path: shot('owner-billing', project) });

  // Coming back to the same outlet keeps the same code.
  await page.getByRole('button', { name: 'Outlets' }).click();
  await expect(page.getByText('Last used')).toBeVisible();
  await page.getByRole('link', { name: /Arera Colony/ }).click();
  await expect(banner).toContainText(areraCode);

  // Walk over to MP Nagar: billing there too, with its own code at that outlet.
  await page.getByRole('button', { name: 'Outlets' }).click();
  await page.getByRole('link', { name: /MP Nagar/ }).click();
  await expect(banner).toContainText(/MP Nagar · T\d+/);

  // This is the owner's phone, not a shared tablet: no PIN screen, straight back to their outlets.
  await page.goto('/pin');
  await expect(page).toHaveURL(/\/home$/);
});
