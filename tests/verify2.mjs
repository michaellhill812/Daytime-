import { chromium, OUT, APP, HARNESS } from './pw.mjs';

const pass = [];
const fail = [];
const check = (n, ok, d = '') => (ok ? pass : fail).push(n + (d ? ` — ${d}` : ''));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', (e) => fail.push(`pageerror: ${e.message}`));
await page.goto(`${APP}/`);
await page.waitForTimeout(700);

// A date with no time: the deadline is the day, not a moment in it.
await page.locator('.spoke__hit').first().click();
await page.waitForTimeout(500);
const sheet = page.getByRole('dialog');

const d = new Date();
d.setDate(d.getDate() + 2);
const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
await sheet.locator('input.field').first().fill('Date only task');
await sheet.locator('input.field--date').fill(key);
await sheet.getByRole('button', { name: 'Add' }).click();
await page.waitForTimeout(400);
check('date-only task created', await sheet.getByText('Date only task').first().isVisible());

// The Today shortcut should fill the date field, and only when it is empty.
await sheet.locator('input.field--date').fill('');
await page.waitForTimeout(150);
const todayPill = sheet.getByRole('button', { name: 'Today', exact: true });
check('Today shortcut is available when no date is set', await todayPill.isEnabled());
await todayPill.click();
await page.waitForTimeout(150);
const filled = await sheet.locator('input.field--date').inputValue();
const t = new Date();
const todayKey = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
check('Today shortcut fills today', filled === todayKey, `${filled} vs ${todayKey}`);
check('Today shortcut disables once a date is set', await todayPill.isDisabled());

await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// In World it should read as end of day, not as 11:59 PM.
await page.getByRole('button', { name: 'World', exact: true }).click();
await page.waitForTimeout(500);
await page
  .locator('.day:not(.day--muted)')
  .filter({ has: page.locator('.day__num', { hasText: new RegExp(`^${d.getDate()}$`) }) })
  .first()
  .click();
await page.waitForTimeout(400);
// World renders the day through agenda rows now, so an untimed deadline drops
// to the foot of the day rather than printing a fabricated 11:59 PM.
const also = page
  .locator('.block')
  .filter({ has: page.locator('.block__title', { hasText: /^Also today$/ }) });
check('an untimed deadline leaves the timed schedule', await also.isVisible());
const row = also.locator('.agenda', { hasText: 'Date only task' });
check('and it is listed there', await row.isVisible());
const label = (await row.locator('.agenda__when').textContent())?.trim();
check('it reads as a to-do, not a clock time', label === 'to-do', label ?? '(none)');
check('it does not print a fake precise time', !/11:59/.test(label ?? ''));

// A doc with no spoke must still be listed under the day it was added.
await page.getByRole('button', { name: 'Wall', exact: true }).click();
await page.waitForTimeout(400);
await page.locator('.wall__add').click();
await page.waitForTimeout(400);
const compose = page.getByRole('dialog');
await compose.locator('#new-doc-title').fill('Spokeless note');
await compose.getByRole('button', { name: 'Add to Wall' }).click();
await page.waitForTimeout(400);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'World', exact: true }).click();
await page.waitForTimeout(600);
const wall = page.locator('.block', { hasText: 'Added to the Wall' });
check(
  'a spokeless doc still appears in World',
  (await wall.textContent())?.includes('Spokeless note'),
);

await browser.close();
console.log(`\nPASS ${pass.length}`);
for (const p of pass) console.log('  ✓ ' + p);
if (fail.length) {
  console.log(`\nFAIL ${fail.length}`);
  for (const f of fail) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('\nAll checks passed.');
