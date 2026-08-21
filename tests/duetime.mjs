/**
 * A task's deadline shows its time, wherever the task is listed.
 *
 * The wheel's task rows printed a day word and stopped — "Tomorrow" for a task
 * due tomorrow at 2:30pm — so the time you typed only survived if the deadline
 * happened to be today. And a task due today with *no* time printed "11:59pm",
 * a deadline nobody chose, because that is the minute an untimed due date is
 * stored at.
 *
 * These checks drive the real UI: add a task with a known date and time, then
 * read the label off its row.
 */
import { chromium, OUT, APP, tally } from './pw.mjs';

const { check, report } = tally();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => check(`pageerror: ${e.message}`, false));
await page.goto(`${APP}/`);
await page.waitForTimeout(900);

const key = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

await page.locator('.spoke__hit').first().click();
await page.waitForTimeout(600);
const sheet = page.getByRole('dialog');

/** Add a task and hand back the text of its due chip. */
async function add(title, offset, time) {
  await sheet.locator('input.field').first().fill(title);
  await sheet.locator('input.field--date').fill(key(offset));
  await page.waitForTimeout(150);
  if (time) await sheet.locator('input.field--time').fill(time);
  await sheet.getByRole('button', { name: 'Add', exact: true }).click();
  await page.waitForTimeout(450);
  const row = sheet.locator('.task', { hasText: title }).first();
  return ((await row.locator('.task__due').textContent()) ?? '').trim();
}

// ------------------------------------------------------------- with a time --

const tomorrow = await add('Timed tomorrow', 1, '14:30');
check('a task due tomorrow keeps its time', /2:30pm/i.test(tomorrow), tomorrow);
check('and still says which day', /tomorrow/i.test(tomorrow), tomorrow);

const thisWeek = await add('Timed this week', 3, '09:15');
check('a task later this week keeps its time', /9:15am/i.test(thisWeek), thisWeek);
check('and still names the weekday', /^[A-Z][a-z]{2}\b/.test(thisWeek), thisWeek);

const farOff = await add('Timed far off', 21, '17:45');
check('a task weeks out keeps its time', /5:45pm/i.test(farOff), farOff);
check('and still carries its date', /\d/.test(farOff.replace(/5:45pm/i, '')), farOff);

const later = await add('Timed today', 0, '23:00');
check('a task due later today shows the time alone', /^11:00pm$/i.test(later), later);

// ---------------------------------------------------------- without a time --

// An untimed deadline is stored at 23:59. None of these may print a clock.
const bareTomorrow = await add('Untimed tomorrow', 1, null);
check('an untimed task tomorrow says only the day', /^tomorrow$/i.test(bareTomorrow), bareTomorrow);
check('and invents no 11:59pm', !/11:59/.test(bareTomorrow), bareTomorrow);

const bareWeek = await add('Untimed this week', 4, null);
check('an untimed task this week says only the weekday', !/\d?\d:\d\d/.test(bareWeek), bareWeek);

const bareToday = await add('Untimed today', 0, null);
check('an untimed task due today reads as Today', /^today$/i.test(bareToday), bareToday);
check('and does not fabricate a deadline minute', !/11:59/.test(bareToday), bareToday);

await page.screenshot({ path: `${OUT}/duetime.png` });

// ------------------------------------------------------------- it persists --

await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.reload();
await page.waitForTimeout(900);
await page.locator('.spoke__hit').first().click();
await page.waitForTimeout(600);
const reloaded = (
  (await page
    .getByRole('dialog')
    .locator('.task', { hasText: 'Timed tomorrow' })
    .first()
    .locator('.task__due')
    .textContent()) ?? ''
).trim();
check('the label survives a reload', reloaded === tomorrow, `${tomorrow} → ${reloaded}`);

await browser.close();
report();
