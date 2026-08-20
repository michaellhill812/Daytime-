import { chromium, OUT, APP, HARNESS } from './pw.mjs';

const URL = `${APP}/`;
const pass = [];
const fail = [];
const check = (name, ok, detail = '') => (ok ? pass : fail).push(name + (detail ? ` — ${detail}` : ''));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', (e) => fail.push(`pageerror: ${e.message}`));
await page.goto(URL);
await page.waitForTimeout(600);

// ---------------------------------------------------------------- 1. Wall --
await page.getByRole('button', { name: 'Wall', exact: true }).click();
await page.waitForTimeout(400);
await page.locator('.wall__add').click();
await page.waitForTimeout(400);

const dialog = page.getByRole('dialog');
check('compose sheet opens instead of creating Untitled', await dialog.isVisible());
check('compose has a title field', await dialog.locator('#new-doc-title').isVisible());
check('compose has a spoke select', await dialog.locator('#new-doc-domain').isVisible());

// Pin to Wall must be disabled until there is a title.
check(
  'cannot pin an untitled document',
  await dialog.getByRole('button', { name: 'Add to Wall' }).isDisabled(),
);

await dialog.locator('#new-doc-title').fill('Verify note');
const spokeOptions = await dialog.locator('#new-doc-domain option').allTextContents();
check('spoke list carries the real spokes', spokeOptions.length > 3, spokeOptions.join('/'));
await dialog.locator('#new-doc-domain').selectOption({ label: spokeOptions[1] });
await dialog.locator('#new-doc-body').fill('Body written at compose time.');
await dialog.getByRole('button', { name: 'Add to Wall' }).click();
await page.waitForTimeout(500);

// The doc sheet should now be open on the new document.
const docSheet = page.getByRole('dialog');
check('new doc opens after creating', (await docSheet.getByRole('heading').first().textContent())?.includes('Verify note'));
check(
  'new doc kept its spoke',
  (await docSheet.locator('.sheet__subtitle').textContent())?.includes(spokeOptions[1]),
);
check('new doc kept its body', (await docSheet.locator('textarea.field--body').inputValue()).includes('Body written at compose time'));
check('doc sheet can re-file the spoke', await docSheet.locator('#doc-domain').isVisible());

await page.keyboard.press('Escape');
await page.waitForTimeout(400);
const cardTitles = await page.locator('.card__title').allTextContents();
check('card shows the real title, not Untitled', cardTitles.includes('Verify note'));
check('no Untitled cards were created', !cardTitles.includes('Untitled'));

// -------------------------------------------------------------- 2. World --
await page.getByRole('button', { name: 'World', exact: true }).click();
await page.waitForTimeout(500);

// The doc just pinned was added today, so today's panel should acknowledge it.
const wallBlock = page.locator('.block', { hasText: 'Added to the Wall' });
check('World lists documents added that day', await wallBlock.isVisible());
check(
  'the added document is named there',
  (await wallBlock.textContent())?.includes('Verify note'),
);
check('month grid marks a day with Wall additions', (await page.locator('.day__wall').count()) > 0);

// Opening it from World should reach the same document.
await wallBlock.locator('.event-row').filter({ hasText: 'Verify note' }).click();
await page.waitForTimeout(400);
check(
  'World links through to the document',
  (await page.getByRole('dialog').getByRole('heading').first().textContent())?.includes('Verify note'),
);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// Event with category + priority.
await page.getByRole('button', { name: '+ Event' }).click();
await page.waitForTimeout(300);
const quick = page.locator('.world__day .quick-add');
await quick.locator('input.field').first().fill('Verify event');
await quick.locator('select.field--select').selectOption({ label: spokeOptions[1] });
const prioPill = quick.locator('.pill');
check('event form has a priority control', await prioPill.isVisible());
const before = await prioPill.textContent();
await prioPill.click();
await page.waitForTimeout(150);
check('event priority cycles', (await prioPill.textContent()) !== before, `${before} -> ${await prioPill.textContent()}`);
const chosen = await prioPill.textContent();
await quick.getByRole('button', { name: 'Add' }).click();
await page.waitForTimeout(400);

const evRow = page.locator('.agenda').filter({ hasText: 'Verify event' });
check('event was created', await evRow.isVisible());
check('event row shows a priority mark', (await evRow.locator('.event-row__priority').count()) === 1);
await evRow.locator('.agenda__title').click();
await page.waitForTimeout(400);
const evSheet = page.getByRole('dialog');
check(
  'event kept its spoke',
  (await evSheet.locator('select.field--select').inputValue()) !== '',
);
check(
  'event kept its priority',
  (await evSheet.locator('.pill').textContent())?.trim() === chosen?.trim(),
  `sheet=${await evSheet.locator('.pill').textContent()} form=${chosen}`,
);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// -------------------------------------------------------------- 3. Wheel --
await page.getByRole('button', { name: 'Wheel', exact: true }).click();
await page.waitForTimeout(500);
await page.locator('.spoke__hit').first().click();
await page.waitForTimeout(500);

const domSheet = page.getByRole('dialog');
const dateField = domSheet.locator('input.field--date');
const timeField = domSheet.locator('input.field--time');
check('wheel quick-add has a date input', await dateField.isVisible());
check('wheel quick-add has a time input', await timeField.isVisible());
check('time is disabled until a date is picked', await timeField.isDisabled());

// Pick tomorrow so it is unambiguous against any existing task.
const d = new Date();
d.setDate(d.getDate() + 1);
const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
await domSheet.locator('input.field').first().fill('Verify task');
await dateField.fill(key);
await page.waitForTimeout(150);
check('time enables once a date is set', await timeField.isEnabled());
await timeField.fill('14:30');
await domSheet.getByRole('button', { name: 'Add' }).click();
await page.waitForTimeout(400);
check('task was created', await domSheet.getByText('Verify task').first().isVisible());
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// It must now appear on tomorrow in World.
await page.getByRole('button', { name: 'World', exact: true }).click();
await page.waitForTimeout(500);
await page
  .locator('.day:not(.day--muted)')
  .filter({ has: page.locator('.day__num', { hasText: new RegExp(`^${d.getDate()}$`) }) })
  .first()
  .click();
await page.waitForTimeout(400);
const dueBlock = page.locator('.block').filter({ has: page.locator('.block__title', { hasText: /^Schedule$/ }) });
check(
  'wheel task with a date lands on the calendar',
  (await dueBlock.textContent())?.includes('Verify task'),
);

// And the time has to survive, not snap to a default.
const bodyText = await page.locator('.world__day').textContent();
check('the chosen time survived', /2:30|14:30/.test(bodyText ?? ''), bodyText?.slice(0, 200));

// ------------------------------------------------------------ persistence --
await page.reload();
await page.waitForTimeout(900);
await page.getByRole('button', { name: 'Wall', exact: true }).click();
await page.waitForTimeout(400);
check(
  'everything survived a reload',
  (await page.locator('.card__title').allTextContents()).includes('Verify note'),
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
