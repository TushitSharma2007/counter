import { expect, test, type Page } from '@playwright/test';
import { pinIn, registerTablet, shot, startDay } from './helpers.ts';

// Needs the local stack with the demo seed: pnpm db:start (or db:reset).
// Registers a fresh tablet each run, so its bill series always starts at 1.

async function addAndPay(page: Page, item: string, mode: 'Cash' | 'UPI') {
  await page.getByRole('button', { name: new RegExp(`^${item},`) }).click();
  await page
    .getByRole('complementary', { name: 'Bill' })
    .getByRole('button', { name: /^Pay / })
    .click();
  const pay = page.getByRole('dialog', { name: 'Take payment' });
  await pay.getByRole('radio', { name: mode }).click();
  if (mode === 'UPI') {
    await expect(pay.getByRole('img', { name: /UPI QR for/ })).toBeVisible();
    await page.screenshot({ path: shot('billing-upi', 'tablet') });
  }
  await pay
    .getByRole('button', { name: mode === 'Cash' ? 'Bill paid' : 'Payment received' })
    .click();
  const paid = page.getByRole('dialog', { name: 'Bill paid' });
  await expect(paid).toBeVisible();
  const number = /ARC-T\d+\/\d{4}\/\d{6}/.exec((await paid.textContent()) ?? '')?.[0] ?? '';
  await paid.getByRole('button', { name: 'New bill' }).click();
  return number;
}

test('bills keep going offline, sync when back, and a manager can void one', async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name !== 'tablet', 'the counter tablet is where this matters');
  await registerTablet(page);
  await pinIn(page, 'Priya Sharma', '1357');
  await startDay(page);
  await expect(page.getByRole('region', { name: 'All items' })).toBeVisible();

  // Bill 1, online.
  const first = await addAndPay(page, 'Veg Puff', 'Cash');
  expect(first).toMatch(/\/000001$/);
  await expect(page.getByRole('status').first()).toHaveText('Live');

  // The internet drops: billing carries on, numbered on the tablet, and queues.
  await context.setOffline(true);
  const second = await addAndPay(page, 'Masala Chai', 'UPI');
  expect(second).toMatch(/\/000002$/);
  await expect(page.getByRole('status').first()).toHaveText('Offline – 1 bill queued');
  await page.screenshot({ path: shot('billing-offline', info.project.name) });

  await page.getByRole('button', { name: /^Bills/ }).click();
  const bills = page.getByRole('dialog', { name: 'Bills on this device' });
  await expect(
    bills.getByRole('button', { name: new RegExp(second.replace(/[/]/g, '\\/')) }),
  ).toContainText('Waiting to sync');
  await expect(
    bills.getByRole('button', { name: new RegExp(first.replace(/[/]/g, '\\/')) }),
  ).toContainText('Synced');
  await page.keyboard.press('Escape');

  // Back online: the queued bill goes up by itself.
  await context.setOffline(false);
  await expect(page.getByRole('status').first()).toHaveText('Live', { timeout: 15_000 });

  // Void bill 1 with the manager's PIN.
  await page.getByRole('button', { name: /^Bills/ }).click();
  await bills.getByRole('button', { name: new RegExp(first.replace(/[/]/g, '\\/')) }).click();
  const detail = page.getByRole('dialog', { name: first });
  await expect(detail.getByRole('article', { name: `Receipt ${first}` })).toBeVisible();
  await page.screenshot({ path: shot('bill-detail', info.project.name) });
  await detail.getByRole('button', { name: 'Void this bill' }).click();
  const voiding = page.getByRole('dialog', { name: `Void ${first}?` });
  await voiding.getByRole('button', { name: 'Customer cancelled' }).click();
  await expect(voiding.getByRole('group', { name: 'Manager PIN for Rohan Mehta' })).toBeVisible();
  await page.keyboard.type('1111');
  await expect(voiding.getByText('Wrong PIN.')).toBeVisible();
  await page.keyboard.type('2580');
  await expect(page.getByText('Bill voided', { exact: true })).toBeVisible();
  await expect(detail.getByText(/^Void/).first()).toBeVisible();
});
