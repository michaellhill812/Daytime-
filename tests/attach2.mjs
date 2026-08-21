/**
 * Two faults in attaching Wall documents to tasks.
 *
 * 1. The doc chip on a *completed* task did nothing. TaskRow took the open
 *    handlers as optional props and three of the five lists rendering a task
 *    row never passed them — the done list among them. The chip looked live,
 *    was focusable, and swallowed the tap.
 *
 * 2. Attaching was only reachable after the fact: create the task, reopen it,
 *    attach from its sheet. There was no way to say "this task is about that
 *    document" at the moment you knew it.
 *
 * The two are independent, so when the attach control is missing the suite
 * records those checks as failures and reaches the completed-task half by
 * attaching through the task sheet instead. Both halves then report against
 * either build rather than one crashing out.
 */
import { chromium, OUT, APP, tally } from './pw.mjs';

const { check, report } = tally();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => check(`pageerror: ${e.message}`, false));
await page.goto(`${APP}/`);
await page.waitForTimeout(900);

await page.locator('.spoke__hit').first().click();
await page.waitForTimeout(600);
const sheet = page.getByRole('dialog');

const attachBtn = sheet.getByRole('button', { name: /^Docs/ });
const hasAttach = (await attachBtn.count()) > 0;

/** Title of the document the task under test ends up carrying. */
let attachedTitle = null;

check('the quick-add offers an attach control', hasAttach);

if (hasAttach) {
  // ---------------------------------------- attaching while creating a task --
  check('it starts collapsed', (await sheet.locator('.quick-attach').count()) === 0);

  await attachBtn.click();
  await page.waitForTimeout(300);
  const picker = sheet.locator('.quick-attach');
  check('opening it reveals the Wall documents', await picker.isVisible());

  const offered = await picker.locator('.chip--pick').allTextContents();
  check('every document is offerable', offered.length > 1, `${offered.length} offered`);

  const first = picker.locator('.chip--pick').first();
  attachedTitle = (await first.textContent())?.trim() ?? null;
  await first.click();
  await page.waitForTimeout(250);
  check('picking a document marks it', (await first.getAttribute('aria-pressed')) === 'true');
  check(
    'the control counts what is picked',
    ((await attachBtn.textContent()) ?? '').includes('1'),
    await attachBtn.textContent(),
  );

  await sheet.locator('.quick-add input.field').first().fill('Task born attached');
  await sheet.getByRole('button', { name: 'Add', exact: true }).click();
  await page.waitForTimeout(500);

  const newRow = sheet.locator('.task', { hasText: 'Task born attached' }).first();
  check('the task was created', await newRow.isVisible());
  const chip = newRow.locator('.chip--doc');
  check('and it carries the document from the moment it exists', (await chip.count()) === 1);
  check(
    'the chip names the document',
    (await chip.textContent())?.includes(attachedTitle ?? '§'),
    attachedTitle ?? '(none)',
  );

  // The picker must reset, or the next task silently inherits the last one's refs.
  check('the picker collapsed after adding', (await sheet.locator('.quick-attach').count()) === 0);
  check(
    'and its selection was cleared',
    !/\d/.test((await attachBtn.textContent()) ?? ''),
    await attachBtn.textContent(),
  );

  await sheet.locator('.quick-add input.field').first().fill('Task born bare');
  await sheet.getByRole('button', { name: 'Add', exact: true }).click();
  await page.waitForTimeout(500);
  const bare = sheet.locator('.task', { hasText: 'Task born bare' }).first();
  check(
    'the next task does not inherit the last attachment',
    (await bare.locator('.chip--doc').count()) === 0,
  );

  await page.screenshot({ path: `${OUT}/attach-create.png` });
} else {
  for (const name of [
    'it starts collapsed',
    'opening it reveals the Wall documents',
    'every document is offerable',
    'picking a document marks it',
    'the control counts what is picked',
    'the task was created',
    'and it carries the document from the moment it exists',
    'the chip names the document',
    'the picker collapsed after adding',
    'and its selection was cleared',
    'the next task does not inherit the last attachment',
  ]) {
    check(name, false, 'no attach control in the quick-add');
  }
}

// ------------------------------------------- the chip works on a done task --

// No setup needed: the seed already has tasks carrying references, so this half
// tests the same fault on either build. Pick an open one that has a chip.
const seeded = sheet.locator('.task:not(.task--done):has(.chip--doc)').first();
check('the spoke has a task with a reference on it', (await seeded.count()) > 0);

const seededTitle = (await seeded.locator('.task__title').textContent())?.trim() ?? '';
const wanted = (await seeded.locator('.chip--doc').first().textContent())?.trim() ?? '';

// It opens while the task is open — this always worked, and is the control.
await seeded.locator('.chip--doc').first().click();
await page.waitForTimeout(700);
const openHeading = (await page.getByRole('dialog').last().getByRole('heading').first().textContent())?.trim();
check('the chip works on an open task', openHeading === wanted, `opened "${openHeading}"`);
await page.keyboard.press('Escape');
await page.waitForTimeout(600);

// Now tick it off and try the same chip from the done list.
const again = sheet.locator('.task', { hasText: seededTitle }).first();
await again.locator('.task__check').click();
await page.waitForTimeout(500);
await sheet.locator('.disclosure').click();
await page.waitForTimeout(500);

const doneRow = sheet.locator('.task--done', { hasText: seededTitle }).first();
check('the completed task is listed', await doneRow.isVisible());
const doneChip = doneRow.locator('.chip--doc').first();
check('it still shows its document', (await doneChip.count()) === 1);

const before = await page.getByRole('dialog').count();
await doneChip.click();
await page.waitForTimeout(700);

// This is the check that failed: the tap was swallowed and no sheet opened.
const heading = (await page.getByRole('dialog').last().getByRole('heading').first().textContent())?.trim();
check(
  'the chip on a completed task opens a sheet at all',
  (await page.getByRole('dialog').count()) > before,
  `${before} sheets before, ${await page.getByRole('dialog').count()} after`,
);
check('and what it opens is the document itself', heading === wanted, `opened "${heading}", expected "${wanted}"`);

await page.screenshot({ path: `${OUT}/attach-done.png` });

await browser.close();
report();
