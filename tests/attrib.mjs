import { chromium, OUT, APP, HARNESS } from './pw.mjs';

const pass = [];
const fail = [];
const check = (n, ok, d = '') => (ok ? pass : fail).push(n + (d ? ` — ${d}` : ''));
const KEY = 'daytime.state.v1';
const URL = `${APP}/`;

const browser = await chromium.launch();

// --------------------------------------------- 1. a workspace of one person --
const solo = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p1 = await solo.newPage();
p1.on('pageerror', (e) => fail.push(`pageerror: ${e.message}`));
await p1.goto(URL);
await p1.waitForTimeout(700);

check('no bell when nobody else has added anything', (await p1.locator('.bell').count()) === 0);

await p1.getByRole('button', { name: 'Wall', exact: true }).click();
await p1.waitForTimeout(400);
await p1.locator('.wall__add').click();
await p1.waitForTimeout(400);
await p1.locator('#new-doc-title').fill('Mine alone');
await p1.getByRole('button', { name: 'Add to Wall' }).click();
await p1.waitForTimeout(400);
await p1.keyboard.press('Escape');
await p1.waitForTimeout(500);

check('your own work is not credited back to you', (await p1.locator('.card__by').count()) === 0);
check('and adding your own work raises no bell', (await p1.locator('.bell').count()) === 0);

// Take the real state the app just wrote — the flush on page-hide means editing
// storage under a live app gets clobbered, so capture it and seed a fresh
// context instead.
const raw = await p1.evaluate((k) => window.localStorage.getItem(k), KEY);
await solo.close();

// -------------------------------------- 2. the same workspace, two people in --
const state = JSON.parse(raw);
const stamp = new Date().toISOString();
const doc = state.docs.find((d) => d.title === 'Mine alone');
doc.title = 'Andrew’s note';
doc.createdBy = 'andrew.smith@example.com';
doc.createdAt = stamp;
state.tasks.push({
  id: 'task_andrew',
  domainId: state.domains[0].id,
  title: 'Andrew’s task',
  priority: 2,
  done: false,
  docIds: [],
  eventIds: [],
  createdBy: 'andrew.smith@example.com',
  createdAt: stamp,
});

const shared = await browser.newContext({ viewport: { width: 390, height: 844 } });
await shared.addInitScript(
  ([k, v]) => window.localStorage.setItem(k, v),
  [KEY, JSON.stringify(state)],
);
const p = await shared.newPage();
p.on('pageerror', (e) => fail.push(`pageerror: ${e.message}`));
await p.goto(URL);
await p.waitForTimeout(800);

check('the bell appears once someone else has added things', await p.locator('.bell').isVisible());
const badge = await p.locator('.bell__count').textContent();
check('the bell counts what is unseen', badge === '2', badge ?? '(none)');

await p.getByRole('button', { name: 'Wall', exact: true }).click();
await p.waitForTimeout(400);
const by = await p.locator('.card__by').first().textContent();
check('a Wall card names who added it', by?.includes('Andrew Smith'), by ?? '(none)');
check('the address is read as a name, not an email', !by?.includes('@'), by ?? '');
check('only the other person’s card is credited', (await p.locator('.card__by').count()) === 1);
await p.screenshot({ path: `${OUT}/attrib-wall.png` });

await p.locator('.bell').click();
await p.waitForTimeout(500);
const feed = p.getByRole('dialog');
check('the feed opens', await feed.isVisible());
const feedText = (await feed.textContent()) ?? '';
check('the feed lists the document', feedText.includes('Andrew’s note'));
check('the feed lists the task', feedText.includes('Andrew’s task'));
check(
  'the feed says where each thing landed',
  /to the Wall/.test(feedText) && /to the Wheel/.test(feedText),
);
check('the feed names the person', feedText.includes('Andrew Smith'));
await p.screenshot({ path: `${OUT}/attrib-feed.png` });

await p.keyboard.press('Escape');
await p.waitForTimeout(400);
check('opening the feed clears the count', (await p.locator('.bell__count').count()) === 0);
check('the bell itself stays, for the history', await p.locator('.bell').isVisible());

// The marker has to survive a reload, or the count comes back every visit.
await p.reload();
await p.waitForTimeout(900);
check('the count stays cleared across a reload', (await p.locator('.bell__count').count()) === 0);
check('the bell is still there after reload', await p.locator('.bell').isVisible());

// A task by someone else is credited in the Wheel too.
await p.getByRole('button', { name: 'Wheel', exact: true }).click();
await p.waitForTimeout(500);
await p.locator('.spoke__hit').first().click();
await p.waitForTimeout(600);
const sheetText = (await p.getByRole('dialog').textContent()) ?? '';
check(
  'a task in the Wheel names its author',
  /added by Andrew Smith/.test(sheetText),
  sheetText.slice(0, 120),
);

// Opening something from the feed should reach the real item.
await p.keyboard.press('Escape');
await p.waitForTimeout(400);
await p.locator('.bell').click();
await p.waitForTimeout(450);
await p.locator('.sheet .agenda', { hasText: 'Andrew’s note' }).click();
await p.waitForTimeout(500);
check(
  'the feed opens the thing it names',
  ((await p.getByRole('dialog').last().textContent()) ?? '').includes('Andrew’s note'),
);

await browser.close();
console.log(`\nPASS ${pass.length}`);
for (const x of pass) console.log('  ✓ ' + x);
if (fail.length) {
  console.log(`\nFAIL ${fail.length}`);
  for (const f of fail) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('\nAll checks passed.');
