import { expect, test } from '@playwright/test';
import { ownerSignIn, pinIn, registerTablet, shot, startDay } from './helpers.ts';

// Needs the local stack with the demo seed: pnpm db:start (or db:reset).

test('split a bill between cash and UPI, then the owner voids it from their phone', async ({
  page,
  browser,
}, info) => {
  test.skip(info.project.name !== 'tablet', 'one run: a tablet bills, a laptop looks across bills');

  // At the counter: ₹88, paid ₹50 cash + ₹38 UPI.
  await registerTablet(page);
  await pinIn(page, 'Priya Sharma', '1357');
  await startDay(page);
  await expect(page.getByRole('region', { name: 'All items' })).toBeVisible();
  await page.getByRole('button', { name: /^Veg Puff,/ }).click();
  await page.getByRole('button', { name: /^Masala Chai,/ }).click();
  await page
    .getByRole('complementary', { name: 'Bill' })
    .getByRole('button', { name: 'Pay ₹88' })
    .click();

  const pay = page.getByRole('dialog', { name: 'Take payment' });
  await pay.getByRole('radio', { name: 'Split' }).click();
  await pay
    .getByRole('group', { name: 'Amount for this part' })
    .getByRole('button', { name: '5' })
    .click();
  await pay
    .getByRole('group', { name: 'Amount for this part' })
    .getByRole('button', { name: '0', exact: true })
    .click();
  await pay.getByRole('button', { name: 'Add ₹50 by Cash' }).click();
  await pay.getByRole('radio', { name: 'UPI' }).last().click();
  await expect(pay.getByRole('img', { name: /UPI QR for ₹38/ })).toBeVisible();
  await page.screenshot({ path: shot('billing-split', info.project.name) });
  await pay.getByRole('button', { name: 'Add ₹38 by UPI' }).click();
  await expect(pay.getByText('All paid')).toBeVisible();
  await pay.getByRole('button', { name: 'Bill paid' }).click();

  const paid = page.getByRole('dialog', { name: 'Bill paid' });
  await expect(paid).toContainText('Paid Cash ₹50 + UPI ₹38');
  const number = /ARC-T\d+\/\d{4}\/\d{6}/.exec((await paid.textContent()) ?? '')?.[0] ?? '';
  await paid.getByRole('button', { name: 'New bill' }).click();
  await expect(page.getByRole('status').first()).toHaveText('Live', { timeout: 15_000 });

  // The owner, on a laptop: every tablet's bills today, and void this one.
  const laptopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const laptop = await laptopContext.newPage();
  await ownerSignIn(laptop);
  await laptop.getByRole('link', { name: /^Bills/ }).click();
  const row = laptop.getByRole('button', { name: new RegExp(number.replace(/\//g, '\\/')) });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await laptop.screenshot({ path: shot('owner-bills', 'desktop') });
  await row.click();
  await laptop.getByRole('button', { name: 'Void this bill' }).click();
  const voiding = laptop.getByRole('dialog', { name: `Void ${number}?` });
  await voiding.getByRole('button', { name: 'Billing mistake' }).click();
  await voiding.getByRole('button', { name: 'Void bill' }).click();
  await expect(laptop.getByText('Bill voided', { exact: true })).toBeVisible();
  await expect(
    laptop.getByRole('button', { name: new RegExp(number.replace(/\//g, '\\/')) }),
  ).toContainText('Void');
  await laptopContext.close();
});
