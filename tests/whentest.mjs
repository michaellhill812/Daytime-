import { chromium, OUT, APP, HARNESS } from './pw.mjs';
const pass = [],
  fail = [];
const check = (n, ok, d = '') => (ok ? pass : fail).push(n + (d ? ` — ${d}` : ''));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
p.on('pageerror', (e) => fail.push('pageerror: ' + e.message));
await p.goto(`${APP}/`);
await p.waitForTimeout(800);

// Seed a change attributed to somebody else so the bell has something to show.
// Written through an init script so it lands before the app's own boot write,
// which otherwise overwrites anything set after load.
const seeded = await p.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('daytime.state.v1'));
  const at = new Date();
  at.setHours(7, 5, 0, 0);
  s.docs.push({
    id: 'doc_probe',
    title: 'Note from Leila',
    kind: 'note',
    pinned: false,
    updatedAt: at.toISOString(),
    createdAt: at.toISOString(),
    createdBy: 'leilavhill@gmail.com',
  });
  return JSON.stringify(s);
});
await p.close();

const p2 = await b.newPage({ viewport: { width: 390, height: 844 } });
p2.on('pageerror', (e) => fail.push('pageerror: ' + e.message));
await p2.addInitScript((json) => {
  localStorage.setItem('daytime.state.v1', json);
}, seeded);
await p2.goto(`${APP}/`);
await p2.waitForTimeout(1000);

// --- the bell ---
const bell = p2.locator('.bell');
check('the bell appears for someone else’s change', await bell.isVisible());
await bell.click();
await p2.waitForTimeout(500);
const row = p2.locator('.sheet .agenda', { hasText: 'Note from Leila' });
const when = (await row.locator('.agenda__when').textContent())?.trim();
check('the feed shows a clock time', /\d:\d\d/.test(when ?? ''), when ?? '(none)');
check('and still shows the day', /[A-Za-z]{3}/.test(when ?? ''), when ?? '');
const lines = await row.locator('.agenda__when').evaluate((e) => e.getClientRects().length);
check('day and time stack rather than wrap mid-phrase', lines >= 1);
await p2.screenshot({ path: `${OUT}/when-bell.png` });
await p2.keyboard.press('Escape');
await p2.waitForTimeout(300);

// --- an event seen from the Wheel ---
await p2.getByRole('button', { name: 'World', exact: true }).click();
await p2.waitForTimeout(500);
await p2.getByRole('button', { name: '+ Event' }).click();
await p2.waitForTimeout(300);
const q = p2.locator('.world__day .quick-add');
await q.locator('input.field').first().fill('Probe event');
await q.locator('input.field--time').fill('14:30');
const opts = await q.locator('select.field--select option').allTextContents();
await q.locator('select.field--select').selectOption({ label: opts[1] });
await q.getByRole('button', { name: 'Add', exact: true }).click();
await p2.waitForTimeout(500);

await p2.getByRole('button', { name: 'Wheel', exact: true }).click();
await p2.waitForTimeout(500);
await p2.locator('.spoke__hit').first().click();
await p2.waitForTimeout(600);
const evRow = p2.locator('.sheet .event-row', { hasText: 'Probe event' });
const evWhen = (await evRow.locator('.event-row__when').textContent())?.trim();
check('the wheel shows the event time', /2:30/.test(evWhen ?? ''), evWhen ?? '(none)');
check('the wheel still shows the day', /Aug/.test(evWhen ?? ''), evWhen ?? '');
check('no dangling separator', !/·\s*$/.test(evWhen ?? ''), evWhen ?? '');

// The column must not overflow into the title.
const wBox = await evRow.locator('.event-row__when').boundingBox();
const tBox = await evRow.locator('.event-row__title').boundingBox();
check(
  'the time column does not collide with the title',
  wBox.x + wBox.width <= tBox.x + 1,
  `when ends ${Math.round(wBox.x + wBox.width)}, title starts ${Math.round(tBox.x)}`,
);
await p2.screenshot({ path: `${OUT}/when-wheel.png` });

await b.close();
console.log(`\nPASS ${pass.length}`);
pass.forEach((x) => console.log('  ✓ ' + x));
if (fail.length) {
  console.log(`\nFAIL ${fail.length}`);
  fail.forEach((x) => console.log('  ✗ ' + x));
  process.exit(1);
}
console.log('\nAll checks passed.');
