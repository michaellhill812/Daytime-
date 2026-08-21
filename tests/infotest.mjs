import { chromium, OUT, APP, HARNESS } from './pw.mjs';
const pass = [],
  fail = [];
const check = (n, ok, d = '') => (ok ? pass : fail).push(n + (d ? ` — ${d}` : ''));
const b = await chromium.launch();

// First pass: seed a change from somebody else so the bell renders too, and
// the row has more than one thing in it to pack.
const p0 = await b.newPage({ viewport: { width: 390, height: 844 } });
await p0.goto(`${APP}/`);
await p0.waitForTimeout(800);
const seeded = await p0.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('daytime.state.v1'));
  const at = new Date();
  at.setHours(7, 5, 0, 0);
  s.docs.push({
    id: 'doc_probe',
    title: 'From Leila',
    kind: 'note',
    pinned: false,
    updatedAt: at.toISOString(),
    createdAt: at.toISOString(),
    createdBy: 'leila@example.com',
  });
  return JSON.stringify(s);
});
await p0.close();

const p = await b.newPage({ viewport: { width: 390, height: 844 } });
p.on('pageerror', (e) => fail.push('pageerror: ' + e.message));
await p.addInitScript((json) => localStorage.setItem('daytime.state.v1', json), seeded);
await p.goto(`${APP}/`);
await p.waitForTimeout(1000);

const info = p.locator('.info');
check('the info button is present', await info.isVisible());
check(
  'it opens the field guide',
  (await info.getAttribute('href')) ===
    'https://claude.ai/code/artifact/d645ba04-afed-4048-b451-7d62c864d52d',
  await info.getAttribute('href'),
);
check('it opens in a new tab', (await info.getAttribute('target')) === '_blank');
check('it is labelled for screen readers', !!(await info.getAttribute('aria-label')));

// Packing: info and bell should sit side by side with the row's gap, and the
// bell should stay clear of the account button's slot.
const ib = await info.boundingBox();
const bb = await p.locator('.bell').boundingBox();
check('the bell renders alongside it', !!bb);
check('they sit on the same line', Math.abs(ib.y - bb.y) < 1, `${ib.y} vs ${bb.y}`);
check(
  'they are packed, not overlapping',
  bb.x - (ib.x + ib.width) === 10,
  `gap ${bb.x - (ib.x + ib.width)}`,
);
check(
  'the row clears the account button slot',
  bb.x + bb.width <= 390 - 50,
  `bell ends ${Math.round(bb.x + bb.width)}`,
);

// The badge is absolutely positioned; the button must be its containing block.
const badge = await p.locator('.bell__count').boundingBox();
check(
  'the unread badge sits on the bell, not adrift',
  badge.x > bb.x && badge.x < bb.x + bb.width + 8 && Math.abs(badge.y - (bb.y - 4)) < 6,
  `badge ${Math.round(badge.x)},${Math.round(badge.y)} bell ${Math.round(bb.x)},${Math.round(bb.y)}`,
);

check(
  'nothing scrolls sideways',
  !(await p.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )),
);

await p.screenshot({ path: `${OUT}/hud.png`, clip: { x: 180, y: 0, width: 210, height: 70 } });
await b.close();

console.log(`\nPASS ${pass.length}`);
pass.forEach((x) => console.log('  ✓ ' + x));
if (fail.length) {
  console.log(`\nFAIL ${fail.length}`);
  fail.forEach((x) => console.log('  ✗ ' + x));
  process.exit(1);
}
console.log('\nAll checks passed.');
