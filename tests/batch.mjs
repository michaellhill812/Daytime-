import { chromium, OUT, APP, HARNESS } from './pw.mjs';

const pass = [];
const fail = [];
const check = (n, ok, d = '') => (ok ? pass : fail).push(n + (d ? ` — ${d}` : ''));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', (e) => fail.push(`pageerror: ${e.message}`));
await page.goto(`${APP}/`);
await page.waitForTimeout(700);

// ------------------------------------------------ the overloaded "pin" verb --
await page.getByRole('button', { name: 'Wall', exact: true }).click();
await page.waitForTimeout(400);
check(
  'adding lives in the header, not at the end of the grid',
  (await page.locator('.wall__add').count()) === 1 &&
    (await page.locator('.card--add').count()) === 0,
);

await page.locator('.wall__add').click();
await page.waitForTimeout(400);
let sheet = page.getByRole('dialog');
check(
  'compose is titled for adding',
  (await sheet.locator('.sheet__title').textContent())?.includes('Add to the Wall'),
);
check(
  'the create button says Add',
  (await sheet.getByRole('button', { name: 'Add to Wall' }).count()) === 1,
);

await sheet.locator('#new-doc-title').fill('Renamed later');
await sheet.getByRole('button', { name: 'Add to Wall' }).click();
await page.waitForTimeout(500);

sheet = page.getByRole('dialog');
const pinBtn = await sheet.getByRole('button', { name: /pin/i }).textContent();
check(
  'the doc sheet does not re-ask you to pin to the Wall',
  !/Pin to Wall/i.test(pinBtn ?? ''),
  pinBtn ?? '',
);
check('it offers pinning to the top instead', /Pin to top/i.test(pinBtn ?? ''), pinBtn ?? '');

// ------------------------------------------------------- editing doc titles --
check('the doc sheet has a title field', await sheet.locator('#doc-title').isVisible());
await sheet.locator('#doc-title').fill('Renamed in place');
await page.waitForTimeout(400);
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
let cards = await page.locator('.card__title').allTextContents();
check(
  'the rename shows on the Wall card',
  cards.includes('Renamed in place'),
  cards.slice(0, 3).join('|'),
);
check('the old title is gone', !cards.includes('Renamed later'));

// -------------------------------------------------------------- Wall search --
await page.fill('.field--search', 'renamed');
await page.waitForTimeout(300);
cards = await page.locator('.card__title').allTextContents();
check(
  'search narrows the Wall',
  cards.length === 1 && cards[0] === 'Renamed in place',
  cards.join('|'),
);

await page.fill('.field--search', 'limiting');
await page.waitForTimeout(300);
cards = await page.locator('.card__title').allTextContents();
check(
  'search finds seeded docs by title',
  cards.some((c) => /Limiting/i.test(c)),
  cards.join('|'),
);

// Body text, not just titles.
await page.fill('.field--search', 'calisthenics');
await page.waitForTimeout(300);
cards = await page.locator('.card__title').allTextContents();
check('search reaches document bodies', cards.length > 0, cards.join('|'));

await page.fill('.field--search', 'zzzznope');
await page.waitForTimeout(300);
check(
  'a search with no hits says so',
  await page.getByText(/Nothing on the Wall matches/).isVisible(),
);

await page.locator('.search__clear').first().click();
await page.waitForTimeout(300);
cards = await page.locator('.card__title').allTextContents();
check('clearing search restores the Wall', cards.length > 10, String(cards.length));

// ----------------------------------------------------- editing wheel tasks --
await page.getByRole('button', { name: 'Wheel', exact: true }).click();
await page.waitForTimeout(500);
await page.locator('.spoke__hit').first().click();
await page.waitForTimeout(500);
sheet = page.getByRole('dialog');

await sheet.locator('input.field').first().fill('Editable task');
await sheet.getByRole('button', { name: 'Add' }).click();
await page.waitForTimeout(400);

await sheet.locator('.task__title', { hasText: 'Editable task' }).click();
await page.waitForTimeout(450);
sheet = page.getByRole('dialog');
check('tapping a task title opens its sheet', await sheet.locator('#task-title').isVisible());
check('the task sheet can change the spoke', await sheet.locator('#task-domain').isVisible());
check('the task sheet has a due date', await sheet.locator('#task-date').isVisible());
check('the task sheet has notes', await sheet.locator('#task-notes').isVisible());

await sheet.locator('#task-title').fill('Edited task');
await page.waitForTimeout(300);
// Two sheets are open here — the task sits on top of the domain it came from.
check('the task sheet stacks over the domain sheet', (await page.locator('.sheet').count()) === 2);
check(
  'the title edit lands',
  (await sheet.locator('.sheet__title').last().textContent())?.includes('Edited task'),
);

// Give it a real time so it lands on the timeline.
const d = new Date();
const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
await sheet.locator('#task-date').fill(key);
await page.waitForTimeout(200);
await sheet.locator('input.field--time').last().fill('14:30');
await page.waitForTimeout(350);
await page.screenshot({ path: `${OUT}/task-sheet.png` });

// One Escape must close exactly one sheet, not the whole stack.
await page.keyboard.press('Escape');
await page.waitForTimeout(350);
check(
  'Escape closes only the top sheet',
  (await page.locator('.sheet').count()) === 1,
  `${await page.locator('.sheet').count()} left`,
);
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
check('a second Escape closes the one beneath', (await page.locator('.sheet').count()) === 0);

// -------------------------------------------------- one unified day agenda --
await page.getByRole('button', { name: 'World', exact: true }).click();
await page.waitForTimeout(600);

const blockNamed = (re) =>
  page.locator('.block').filter({ has: page.locator('.block__title', { hasText: re }) });
const schedule = blockNamed(/^Schedule$/);
check('the day has one Schedule section', await schedule.isVisible());
const scheduleText = (await schedule.textContent()) ?? '';
check('a wheel task appears in the timeline', /Edited task/.test(scheduleText));
check('calendar events appear in the same timeline', /Wake-up|Workout/.test(scheduleText));
check(
  'the old split Events/Due headings are gone',
  (await page.locator('.block__title', { hasText: /^Due$/ }).count()) === 0,
);

// The task must sit in clock order among the events, not in its own list.
const rows = await schedule.locator('.agenda__title').allTextContents();
const idx = rows.findIndex((r) => r === 'Edited task');
check(
  'the task is interleaved, not appended',
  idx > 0 && idx < rows.length - 1,
  `index ${idx} of ${rows.length}`,
);

// A task can be ticked off straight from the calendar.
const taskRow = page.locator('.agenda', { hasText: 'Edited task' });
await taskRow.locator('.agenda__check').click();
await page.waitForTimeout(400);
check(
  'a task can be completed from the timeline',
  (await page.locator('.agenda--done').count()) >= 1,
);
await page.screenshot({ path: `${OUT}/agenda.png` });

// An untimed deadline falls to the foot of the day.
await page.getByRole('button', { name: 'Wheel', exact: true }).click();
await page.waitForTimeout(500);
await page.locator('.spoke__hit').first().click();
await page.waitForTimeout(500);
sheet = page.getByRole('dialog');
await sheet.locator('input.field').first().fill('No clock task');
await sheet.locator('input.field--date').fill(key);
await sheet.getByRole('button', { name: 'Add' }).click();
await page.waitForTimeout(400);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

await page.getByRole('button', { name: 'World', exact: true }).click();
await page.waitForTimeout(600);
const also = blockNamed(/^Also today$/);
check('an untimed deadline drops below the schedule', await also.isVisible());
check('and it is the right one', ((await also.textContent()) ?? '').includes('No clock task'));
check(
  'it is not in the timed schedule',
  !((await blockNamed(/^Schedule$/).textContent()) ?? '').includes('No clock task'),
);

// ------------------------------------------------------------ World search --
await page.fill('.search--world .field--search', 'workout');
await page.waitForTimeout(350);
const results = page.locator('.results');
check('World search returns hits', await results.isVisible());
check('it finds a recurring event', ((await results.textContent()) ?? '').includes('Workout'));
await page.screenshot({ path: `${OUT}/world-search.png` });

await page.fill('.search--world .field--search', 'Edited task');
await page.waitForTimeout(350);
check(
  'World search also finds dated tasks',
  ((await page.locator('.results').textContent()) ?? '').includes('Edited task'),
);

// Choosing a result should move the calendar to that day.
await page.locator('.results .event-row').first().click();
await page.waitForTimeout(450);
check('choosing a result closes the results', (await page.locator('.results').count()) === 0);
check('and the day panel is showing', await page.locator('.world__day-title').isVisible());

await page.fill('.search--world .field--search', 'zzzznope');
await page.waitForTimeout(350);
check('an empty calendar search says so', await page.getByText(/Nothing matches/).isVisible());

// ------------------------------------------------------------- persistence --
await page.reload();
await page.waitForTimeout(1000);
await page.getByRole('button', { name: 'Wall', exact: true }).click();
await page.waitForTimeout(400);
check(
  'everything survived a reload',
  (await page.locator('.card__title').allTextContents()).includes('Renamed in place'),
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
