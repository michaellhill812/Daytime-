/**
 * The outer ring reads open work, not finished work.
 *
 * It used to be a completion bar: the arc was `done / total`, so a domain with
 * four untouched tasks drew nothing at all and looked calmer than one you had
 * nearly cleared. These checks pin the flip — anything open is visible, more
 * open is longer, and clearing a domain empties its arc.
 */
import { chromium, OUT, APP, tally } from './pw.mjs';

const { check, report } = tally();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => check(`pageerror: ${e.message}`, false));
await page.goto(`${APP}/`);
await page.waitForTimeout(900);

/**
 * Every spoke, as the DOM actually reports it: the counts come off the tap
 * target's aria-label, the arc length off the rendered path itself. Measuring
 * the path rather than an attribute means a fill hidden by CSS still counts as
 * absent — which is the failure this whole suite exists to catch.
 */
const read = () =>
  page.$$eval('g.spoke', (groups) =>
    groups.map((g) => {
      const label = g.querySelector('.spoke__hit')?.getAttribute('aria-label') ?? '';
      const m = /^(.*): (\d+) open, (\d+) of (\d+) done$/.exec(label);
      const fill = g.querySelector('.wheel__fill');
      return {
        name: m?.[1] ?? label,
        open: Number(m?.[2] ?? -1),
        done: Number(m?.[3] ?? -1),
        total: Number(m?.[4] ?? -1),
        arc: fill ? Math.round(fill.getTotalLength()) : 0,
      };
    }),
  );

const before = await read();
check('the wheel rendered its spokes', before.length > 0, `${before.length} spokes`);
check(
  'every spoke reported a parseable count',
  before.every((s) => s.open >= 0),
  before.map((s) => `${s.name}=${s.open}`).join(' '),
);

// ---------------------------------------------------------- the flip itself --

// This is the bug as reported: a domain with open tasks and none done showed
// an empty ring. Under the old completion arc, every one of these drew nothing.
const untouched = before.filter((s) => s.open > 0 && s.done === 0);
check(
  'the seed has a domain with open work and nothing done',
  untouched.length > 0,
  untouched.map((s) => `${s.name} ${s.open}/${s.total}`).join(', ') || 'none — test is vacuous',
);
check(
  'open work draws an arc even when nothing is done',
  untouched.every((s) => s.arc > 0),
  untouched.map((s) => `${s.name}=${s.arc}`).join(' '),
);

check(
  'every domain with open work has an arc',
  before.filter((s) => s.open > 0).every((s) => s.arc > 0),
  before
    .filter((s) => s.open > 0 && s.arc === 0)
    .map((s) => s.name)
    .join(', '),
);
check(
  'a domain with nothing open has no arc',
  before.filter((s) => s.open === 0).every((s) => s.arc === 0),
  before
    .filter((s) => s.open === 0 && s.arc > 0)
    .map((s) => `${s.name}=${s.arc}`)
    .join(', '),
);

// A cleared domain is the case the old encoding got exactly backwards: all done
// meant a full bright arc. Now it means an empty one.
const cleared = before.filter((s) => s.total > 0 && s.open === 0);
if (cleared.length > 0) {
  check(
    'a fully finished domain is empty, not full',
    cleared.every((s) => s.arc === 0),
    cleared.map((s) => `${s.name}=${s.arc}`).join(' '),
  );
}

// ------------------------------------------------------------- monotonicity --

// More open work must never draw a shorter arc. Sectors are equal width, so
// lengths are directly comparable between domains.
const busy = before.filter((s) => s.open > 0).sort((a, b) => a.open - b.open);
check(
  'more open work never draws a shorter arc',
  busy.every((s, i) => i === 0 || s.arc >= busy[i - 1].arc),
  busy.map((s) => `${s.name}:${s.open}=${s.arc}`).join(' '),
);
const spread = busy.filter((s) => s.open !== busy[0].open);
if (spread.length > 0) {
  check(
    'a busier domain is visibly busier, not just marginally',
    busy[busy.length - 1].arc > busy[0].arc,
    `${busy[0].name}:${busy[0].open}=${busy[0].arc} vs ${busy[busy.length - 1].name}:${busy[busy.length - 1].open}=${busy[busy.length - 1].arc}`,
  );
}

await page.screenshot({ path: `${OUT}/ring.png` });

// -------------------------------------------------------------- it responds --

// Pick the busiest domain and work it down. The arc has to shrink as tasks are
// ticked off, and vanish when the last one goes.
const target = [...before].sort((a, b) => b.open - a.open)[0];
check('there is a domain to work down', target.open > 0, `${target.name} has ${target.open} open`);

const spokeIndex = before.indexOf(target);
await page.locator('.spoke__hit').nth(spokeIndex).click();
await page.waitForTimeout(600);

const sheet = page.getByRole('dialog');
check(
  'the busiest spoke opened',
  (await sheet.getByRole('heading').first().textContent())?.includes(target.name),
  target.name,
);

// Adding must lengthen it — unless the domain is already at or past the cap,
// where saturation is the documented trade.
const arcOf = async (name) => (await read()).find((s) => s.name === name)?.arc ?? 0;

await sheet.locator('input.field').first().fill('Ring probe task');
await sheet.getByRole('button', { name: 'Add', exact: true }).click();
await page.waitForTimeout(500);
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
const added = await arcOf(target.name);
check(
  'adding open work lengthens the arc',
  target.open >= 6 ? added === target.arc : added > target.arc,
  `${target.open} open ${target.arc} → ${target.open + 1} open ${added}`,
);

// Now clear the whole domain. Every checkbox in the open list.
await page.locator('.spoke__hit').nth(spokeIndex).click();
await page.waitForTimeout(600);
let guard = 40;
while ((await sheet.locator('.task__check[aria-pressed="false"]').count()) > 0 && guard-- > 0) {
  await sheet.locator('.task__check[aria-pressed="false"]').first().click();
  await page.waitForTimeout(220);
}
await page.keyboard.press('Escape');
await page.waitForTimeout(600);

const after = (await read()).find((s) => s.name === target.name);
check('the domain really was cleared', after?.open === 0, `${after?.open} still open`);
check('clearing a domain empties its arc', after?.arc === 0, `arc ${target.arc} → ${after?.arc}`);
check(
  'the finished tasks are still counted',
  (after?.done ?? 0) === (after?.total ?? -1) && (after?.total ?? 0) > 0,
  `${after?.done} of ${after?.total} done`,
);

await page.screenshot({ path: `${OUT}/ring-cleared.png` });

await browser.close();
report();
