/**
 * The one-time document import.
 *
 * Twelve job-application documents had to reach a workspace that already held
 * real work. Seeding could not do it — `createSeedState` only runs for a
 * workspace with nothing in it — and bumping SCHEMA_VERSION would have thrown
 * the real work away. So the pack is applied at the storage boundary, once,
 * with a ledger in the state saying it has been.
 *
 * The dangerous property is the one this suite spends most of its checks on:
 * a document you delete must stay deleted. Without the ledger it would come
 * back on every single reload.
 */
import { chromium, OUT, APP, tally } from './pw.mjs';

const { check, report } = tally();

const EXPECTED = [
  'ActiveSite — Resume (Office Manager)',
  'ActiveSite — Cover Letter (Office Manager)',
  'Astralis — Resume (Operations Associate)',
  'Astralis — Cover Letter (Operations Associate)',
  'CBAI — Resume (Operations Associate)',
  'CBAI — Cover Letter (Operations Associate)',
  'GiveWell — Resume (Operations)',
  'GiveWell — Cover Letter (Operations)',
  'SecureBio — Resume (Operations Specialist)',
  'SecureBio — Cover Letter (Operations Specialist)',
  'Interview Study Guide (general + CBAI, SecureBio)',
  'Interview Study Guide — Addendum (Astralis, ActiveSite, GiveWell)',
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => check(`pageerror: ${e.message}`, false));
await page.goto(`${APP}/`);
await page.waitForTimeout(1000);

/** Every document in the store, read straight out of localStorage. */
const stored = () =>
  page.evaluate(() => {
    const raw = localStorage.getItem('daytime.state.v1');
    if (!raw) return null;
    const s = JSON.parse(raw);
    return {
      imports: s.imports ?? [],
      docs: s.docs.map((d) => ({
        id: d.id,
        title: d.title,
        domainId: d.domainId,
        len: (d.body ?? '').length,
      })),
    };
  });

// The store persists on a debounce, so give the first write a moment to land.
await page.waitForTimeout(600);
let state = await stored();
check('the workspace persisted', state !== null);
check(
  'the pack is recorded as applied',
  state.imports.includes('applications-2026-08'),
  state.imports.join(','),
);

// ------------------------------------------------------------ all present --

const imported = state.docs.filter((d) => d.id.startsWith('doc-app-'));
check('all twelve documents arrived', imported.length === 12, `${imported.length}`);

for (const title of EXPECTED) {
  check(
    `"${title.slice(0, 44)}" is there`,
    imported.some((d) => d.title === title),
  );
}

check(
  'every one is filed under Work',
  imported.every((d) => d.domainId === 'dom-work'),
  [...new Set(imported.map((d) => d.domainId))].join(','),
);
check(
  'every one carries its body',
  imported.every((d) => d.len > 1000),
  `shortest ${Math.min(...imported.map((d) => d.len))} chars`,
);

// Titles are the reason this import exists in this form — they have to be
// distinguishable from each other and from what was already on the Wall.
const titles = state.docs.map((d) => d.title);
check('no two documents share a title', new Set(titles).size === titles.length);

// ------------------------------------------------------- they reach the Wall --

await page.getByRole('button', { name: 'Wall', exact: true }).click();
await page.waitForTimeout(700);
const onWall = await page.locator('.card__title').allTextContents();
check(
  'they show on the Wall',
  EXPECTED.every((t) => onWall.some((c) => c.trim() === t)),
  `${onWall.length} cards`,
);

// Searching a company name has to find that company's pair and nothing else's.
await page.locator('.view--wall .search input').fill('SecureBio');
await page.waitForTimeout(600);
const hits = (await page.locator('.card__title').allTextContents()).map((s) => s.trim());
check('searching a company finds its documents', hits.length >= 2, hits.join(' / '));
check(
  'and the results are that company',
  hits.filter((h) => h.startsWith('SecureBio')).length >= 2,
  hits.join(' / '),
);
await page.locator('.view--wall .search input').fill('');
await page.waitForTimeout(500);

await page.screenshot({ path: `${OUT}/import-wall.png` });

// --------------------------------------------------- a reload does not double --

await page.reload();
await page.waitForTimeout(1200);
const after = await stored();
check(
  'reloading does not import a second copy',
  after.docs.filter((d) => d.id.startsWith('doc-app-')).length === 12,
  `${after.docs.filter((d) => d.id.startsWith('doc-app-')).length}`,
);
check('the ledger holds one entry, not two', after.imports.length === 1, after.imports.join(','));

// ------------------------------------------------------ deletion has to stick --

// This is the check the whole ledger exists for.
await page.getByRole('button', { name: 'Wall', exact: true }).click();
await page.waitForTimeout(700);
const victim = 'GiveWell — Cover Letter (Operations)';
await page.locator('.card', { hasText: victim }).first().click();
await page.waitForTimeout(700);
await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
await page.waitForTimeout(900);

let now = await stored();
check(
  'the document was deleted',
  !now.docs.some((d) => d.title === victim),
  `${now.docs.filter((d) => d.id.startsWith('doc-app-')).length} left`,
);

await page.reload();
await page.waitForTimeout(1200);
now = await stored();
check(
  'and it stays deleted across a reload',
  !now.docs.some((d) => d.title === victim),
  now.docs.some((d) => d.title === victim) ? 'it came back' : 'still gone',
);
check(
  'the other eleven are untouched',
  now.docs.filter((d) => d.id.startsWith('doc-app-')).length === 11,
  `${now.docs.filter((d) => d.id.startsWith('doc-app-')).length}`,
);

// ------------------------------------------------ an edit is never overwritten --

await page.getByRole('button', { name: 'Wall', exact: true }).click();
await page.waitForTimeout(700);
await page.locator('.card', { hasText: 'CBAI — Resume (Operations Associate)' }).first().click();
await page.waitForTimeout(700);
const title = page.getByRole('dialog').locator('#doc-title');
await title.fill('CBAI — Resume (edited by hand)');
await page.waitForTimeout(700);
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
await page.reload();
await page.waitForTimeout(1200);

now = await stored();
const edited = now.docs.find((d) => d.id === 'doc-app-cbai-resume');
check(
  'an edited import keeps the edit after a reload',
  edited?.title === 'CBAI — Resume (edited by hand)',
  edited?.title,
);
check(
  'and no duplicate was added alongside it',
  now.docs.filter((d) => d.id === 'doc-app-cbai-resume').length === 1,
);

await browser.close();
report();
