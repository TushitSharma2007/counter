import { expect, test, type Page } from '@playwright/test';
import { pinIn, registerTablet, shot } from './helpers.ts';

// Needs the local stack with the demo seed: pnpm db:start (or db:reset).

const isPhone = (project: string) => project === 'phone';

async function add(page: Page, project: string, item: string) {
  if (isPhone(project))
    await page.getByRole('button', { name: `Add ${item}`, exact: true }).click();
  else await page.getByRole('button', { name: new RegExp(`^${item},`) }).click();
}

test('bill a takeaway order and take cash', async ({ page }, info) => {
  const project = info.project.name;
  await registerTablet(page);
  await pinIn(page, 'Priya Sharma', '1357');
  await expect(page.getByRole('button', { name: 'Lock' })).toBeVisible();
  await page.screenshot({ path: shot('billing-empty', project) });

  // Cold Coffee has sizes, so a tap asks which one.
  await add(page, project, 'Cold Coffee');
  const sizes = page.getByRole('dialog', { name: 'Cold Coffee' });
  await sizes.getByRole('radio', { name: /Large/ }).click();
  await sizes.getByRole('checkbox', { name: /Extra shot/ }).click();
  await sizes.getByRole('button', { name: /Add to bill · ₹229/ }).click();

  await add(page, project, 'Veg Puff');
  await add(page, project, 'Veg Puff');
  await add(page, project, 'Masala Chai');

  if (isPhone(project)) {
    await expect(page.getByRole('button', { name: /4 items/ })).toBeVisible();
    await page.getByRole('button', { name: /View bill/ }).click();
  } else {
    // Keyboard billing: "/" to search, type the code, Enter adds it.
    await page.keyboard.press('/');
    await page.keyboard.type('CHA');
    await page.keyboard.press('Enter');
  }

  const bill = page.getByRole('complementary', { name: 'Bill' }).last();
  await bill.getByRole('radio', { name: 'Takeaway' }).click();
  // 229 + 2 × 39 + 49 (+ 49 by keyboard on tablet/PC)
  const total = isPhone(project) ? '₹356' : '₹405';
  await expect(bill.getByRole('button', { name: `Pay ${total}` })).toBeVisible();
  await page.screenshot({ path: shot('billing-bill', project) });

  await bill.getByRole('button', { name: `Pay ${total}` }).click();
  const pay = page.getByRole('dialog', { name: 'Take payment' });
  await pay.getByRole('button', { name: '₹500' }).click();
  await expect(pay.getByText('Change to return')).toBeVisible();
  await page.screenshot({ path: shot('billing-pay', project) });
  await pay.getByRole('button', { name: 'Bill paid' }).click();

  // The bill is numbered on this device and the change is shown big.
  const paid = page.getByRole('dialog', { name: 'Bill paid' });
  await expect(paid).toContainText(/ARC-T\d+\/\d{4}\/000001/);
  await expect(paid.getByText('Change to return')).toBeVisible();
  await expect(paid).toContainText(/₹(144|95)/);
  await page.screenshot({ path: shot('billing-paid', project) });
  await paid.getByRole('button', { name: 'New bill' }).click();
  await expect(paid).toBeHidden();
});
