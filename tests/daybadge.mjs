/**
 * The calendar's day badge takes its colour from the work it is counting.
 *
 * It was hardcoded to --alert, so a day holding nothing but low-priority work
 * still shouted red. The badge now uses the hottest priority due that day —
 * the same rule the wheel's arc follows, so a colour means one thing in both
 * views.
 *
 * Colours are read off the rendered element rather than the style attribute,
 * so a CSS rule overriding the inline custom property would still be caught.
 */
import { chromium, OUT, APP, tally } from './pw.mjs';

const { check, report } = tally();

// The three priority hues, as selectors.ts defines them.
const HUE = { High: 'rgb(255, 69, 58)', Medium: 'rgb(255, 159, 10)', Low: 'rgb(10, 132, 255)' };

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

/**
 * Add a task to the first spoke, due `offset` days out, at the named priority.
 * The pill cycles High → Medium → Low → High, so it is clicked until it reads
 * what was asked for rather than assuming where it started.
 */
async function addTask(title, offset, priority) {
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
  await sheet.locator('input.field--date').fill(key(offset));
  await sheet.getByRole('button', { name: 'Add', exact: true }).click();
  await page.waitForTimeout(450);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

/** The badge colour on the day `offset` days from today, or null if there is none. */
async function badge(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const cell = page
    .locator('.day:not(.day--muted)')
    .filter({ has: page.locator('.day__num', { hasText: new RegExp(`^${d.getDate()}$`) }) })
    .first();
  const mark = cell.locator('.day__due');
  if ((await mark.count()) === 0) return null;
  return mark.evaluate((el) => {
    const s = getComputedStyle(el);
    return { color: s.color, text: el.textContent?.trim() };
  });
}

// Three days, three priorities, so each hue is proved independently.
await addTask('Low badge probe', 8, 'Low');
await addTask('Medium badge probe', 9, 'Medium');
await addTask('High badge probe', 10, 'High');

await page.getByRole('button', { name: 'World', exact: true }).click();
await page.waitForTimeout(700);

const low = await badge(8);
check('a day with low-priority work is badged', low !== null);
check('and it is not red', low?.color !== HUE.High, low?.color);
check('it takes the low hue', low?.color === HUE.Low, `${low?.color} vs ${HUE.Low}`);

const med = await badge(9);
check('a medium day takes the medium hue', med?.color === HUE.Medium, `${med?.color}`);

const high = await badge(10);
check('a high day is red', high?.color === HUE.High, `${high?.color}`);

// ------------------------------------------------------------- the highest wins --

// Adding quiet work alongside urgent work must not soften the badge.
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
await addTask('Low alongside high', 10, 'Low');
await page.getByRole('button', { name: 'World', exact: true }).click();
await page.waitForTimeout(700);

const mixed = await badge(10);
check('the count went up', mixed?.text === '2', mixed?.text);
check('a mixed day still shows the hottest priority', mixed?.color === HUE.High, `${mixed?.color}`);

// And the reverse: raising the ceiling on a quiet day must heat the badge.
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
await addTask('High alongside low', 8, 'High');
await page.getByRole('button', { name: 'World', exact: true }).click();
await page.waitForTimeout(700);

const raised = await badge(8);
check('the quiet day gained a task', raised?.text === '2', raised?.text);
check(
  'and its badge heated up',
  raised?.color === HUE.High,
  `was ${low?.color}, now ${raised?.color}`,
);

// The background has to follow the colour, or a red wash sits under a blue
// number. color-mix() computes to `color(srgb r g b / a)` rather than rgba(),
// so the assertion is on the alpha channel, not on the notation.
const bg = await page
  .locator('.day:not(.day--muted) .day__due')
  .first()
  .evaluate((el) => getComputedStyle(el).backgroundColor);
const alpha = Number(
  /\/\s*([\d.]+)\s*\)/.exec(bg)?.[1] ?? /rgba\([^)]*,\s*([\d.]+)\)/.exec(bg)?.[1] ?? '1',
);
check(
  'the badge background is a tint, not a solid block',
  alpha > 0 && alpha < 0.5,
  `${bg} → alpha ${alpha}`,
);

// And it must be a tint of the badge's own colour, not a fixed red wash.
const [fg, mixed2] = await page
  .locator('.day:not(.day--muted) .day__due')
  .first()
  .evaluate((el) => {
    const s = getComputedStyle(el);
    return [s.color, s.backgroundColor];
  });
const channels = (s) => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
const [fr, fgc, fb] = channels(fg);
const [br, bg2, bb] = channels(mixed2);
// The srgb form is 0..1 and rgb() is 0..255, so compare ratios rather than values.
const near = (a, b) => Math.abs(a - b) < 0.06;
check(
  'the background is a tint of the badge colour itself',
  near(fr / 255, br) && near(fgc / 255, bg2) && near(fb / 255, bb),
  `${fg} vs ${mixed2}`,
);

await page.screenshot({ path: `${OUT}/daybadge.png` });

await browser.close();
report();
