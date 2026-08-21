/**
 * The hub's number, and what its sheet calls the day.
 *
 * The number was always white, so the one mark carrying the whole day said
 * nothing about how hot the day was — while the ring beside it and the badge
 * in the calendar both spoke in priority hues. It now follows the same rule:
 * the hottest priority standing behind the count.
 *
 * The sheet's title also read "N need you", which named an emotion rather than
 * a state. It says what is on deck instead.
 */
import { chromium, OUT, APP, tally } from './pw.mjs';

const { check, report } = tally();

const HUE = { High: 'rgb(255, 69, 58)', Medium: 'rgb(255, 159, 10)', Low: 'rgb(10, 132, 255)' };
const NEUTRAL = 'rgb(244, 245, 247)';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => check(`pageerror: ${e.message}`, false));
await page.goto(`${APP}/`);
await page.waitForTimeout(900);

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Colour and text of the hub's big number, as rendered. */
const hub = () =>
  page.locator('.hub__count').evaluate((el) => ({
    color: getComputedStyle(el).fill,
    text: el.textContent?.trim(),
  }));

/** Add a task due today at the given priority, from the first spoke. */
async function addToday(title, priority) {
  await page.locator('.spoke__hit').first().click();
  await page.waitForTimeout(500);
  const sheet = page.getByRole('dialog');
  const pill = sheet.locator('.quick-add .pill').first();
  for (let i = 0; i < 4 && (await pill.textContent())?.trim() !== priority; i++) {
    await pill.click();
    await page.waitForTimeout(150);
  }
  check(`the pill reached ${priority}`, (await pill.textContent())?.trim() === priority);
  await sheet.locator('.quick-add input.field').first().fill(title);
  await sheet.locator('input.field--date').fill(todayKey());
  await sheet.locator('input.field--time').fill('23:00');
  await sheet.getByRole('button', { name: 'Add', exact: true }).click();
  await page.waitForTimeout(450);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
}

// ------------------------------------------------------------ the wording --

// Read the count first so the title can be checked against it exactly.
const start = await hub();
await page.locator('.hub').click();
await page.waitForTimeout(700);

const title = (await page.getByRole('dialog').getByRole('heading').first().textContent())?.trim();
check('the sheet no longer says anything needs you', !/need you/i.test(title ?? ''), title);
check('it says what is on deck today', /on deck today$/i.test(title ?? ''), title);
check(
  'and it counts what the hub counts',
  title?.startsWith(`${start.text} `) || start.text === '0',
  `hub ${start.text}, title "${title}"`,
);
check(
  'the verb agrees with the number',
  Number(start.text) === 1 ? /^1 item is /.test(title ?? '') : /^\d+ items are /.test(title ?? ''),
  title,
);

await page.screenshot({ path: `${OUT}/hub-sheet.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(600);

// -------------------------------------------------------------- the colour --

// Whatever the seed leaves on the hub, the number must be a priority hue or
// the neutral default — never something outside the scheme.
const known = [NEUTRAL, ...Object.values(HUE)];
check('the hub number is in the colour scheme', known.includes(start.color), start.color);

// A high-priority task due today has to pull the hub red.
await addToday('Hub high probe', 'High');
const hot = await hub();
check('a high-priority day paints the hub red', hot.color === HUE.High, hot.color);
check('the count rose', Number(hot.text) > Number(start.text), `${start.text} → ${hot.text}`);

// Adding a low-priority task must not cool it — the hottest wins.
await addToday('Hub low probe', 'Low');
const mixed = await hub();
check('adding quiet work does not cool the hub', mixed.color === HUE.High, mixed.color);
check('but it still counts', Number(mixed.text) > Number(hot.text), `${hot.text} → ${mixed.text}`);

await page.screenshot({ path: `${OUT}/hub-hot.png` });

// The word under the number stays neutral — one accent at a time.
const word = await page.locator('.hub__word').evaluate((el) => getComputedStyle(el).fill);
check('the word under the number stays quiet', word !== HUE.High, word);

// -------------------------------------------------------- a clear day --

// Clear everything due, and the hub should fall back to neutral rather than
// keeping the last hue it was given.
await page.getByRole('button', { name: 'Wheel', exact: true }).click();
await page.waitForTimeout(400);
await page.locator('.hub').click();
await page.waitForTimeout(700);
const sheet = page.getByRole('dialog');
let guard = 40;
while ((await sheet.locator('.task__check[aria-pressed="false"]').count()) > 0 && guard-- > 0) {
  await sheet.locator('.task__check[aria-pressed="false"]').first().click();
  await page.waitForTimeout(220);
}
const cleared = (await sheet.getByRole('heading').first().textContent())?.trim();
check('an empty day reads as nothing pressing', cleared === 'Nothing pressing', cleared);

await page.keyboard.press('Escape');
await page.waitForTimeout(700);
const quiet = await hub();
check('a clear hub shows zero', quiet.text === '0', quiet.text);
check('and returns to the neutral colour', quiet.color === NEUTRAL, quiet.color);

await page.screenshot({ path: `${OUT}/hub-clear.png` });

// ------------------------------------------------- the rest of the scheme --

// The seed's own day is already red, so amber and blue have not been proved on
// the hub itself yet. From the cleared state each one can be shown alone.
await addToday('Hub low only', 'Low');
const cool = await hub();
check('a day of only low-priority work is blue', cool.color === HUE.Low, cool.color);

await addToday('Hub medium only', 'Medium');
const warm = await hub();
check('medium alongside low takes the medium hue', warm.color === HUE.Medium, warm.color);

await addToday('Hub high last', 'High');
const hottest = await hub();
check('and high takes it back to red', hottest.color === HUE.High, hottest.color);

await page.screenshot({ path: `${OUT}/hub-scale.png` });

await browser.close();
report();
