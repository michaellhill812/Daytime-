import { chromium, OUT, APP, HARNESS } from './pw.mjs';
const pass = [],
  fail = [];
const check = (n, ok, d = '') => (ok ? pass : fail).push(n + (d ? ` — ${d}` : ''));
const overlaps = (a, b) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const b = await chromium.launch();

for (const vp of [
  { w: 390, h: 844, name: 'iPhone' },
  { w: 1280, h: 900, name: 'desktop' },
]) {
  const p = await b.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
  p.on('pageerror', (e) => fail.push('pageerror: ' + e.message));
  await p.goto(`${APP}/`);
  await p.waitForTimeout(900);
  await p.getByRole('button', { name: 'Wall', exact: true }).click();
  await p.waitForTimeout(700);

  const add = await p.locator('.wall__add').boundingBox();
  const search = await p.locator('.view--wall .search').boundingBox();
  const hud = await p.locator('.hud').boundingBox();

  check(`[${vp.name}] the Add button is in the header`, !!add);
  check(
    `[${vp.name}] the search bar clears the floating buttons`,
    !overlaps(search, hud),
    `search ${Math.round(search.x)},${Math.round(search.y)} ${Math.round(search.width)}x${Math.round(search.height)} vs hud ${Math.round(hud.x)},${Math.round(hud.y)}`,
  );
  check(`[${vp.name}] the Add button clears them too`, !overlaps(add, hud));
  check(
    `[${vp.name}] the search sits below the button band`,
    search.y >= hud.y + hud.height,
    `search top ${Math.round(search.y)}, buttons end ${Math.round(hud.y + hud.height)}`,
  );

  // The add tile must be gone from the grid, and Add must still work.
  check(
    `[${vp.name}] no add tile is left in the grid`,
    (await p.locator('.card--add').count()) === 0,
  );
  await p.locator('.wall__add').click();
  await p.waitForTimeout(500);
  check(`[${vp.name}] it opens the compose sheet`, await p.getByRole('dialog').isVisible());
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  check(
    `[${vp.name}] nothing scrolls sideways`,
    !(await p.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )),
  );

  await p.screenshot({
    path: `${OUT}/wall-${vp.name}.png`,
    clip: { x: 0, y: 0, width: vp.w, height: Math.min(vp.h, 430) },
  });
  await p.close();
}

// The dropdown options must carry their own opaque background.
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
await p.goto(`${APP}/`);
await p.waitForTimeout(800);
await p.getByRole('button', { name: 'Wall', exact: true }).click();
await p.waitForTimeout(500);
await p.locator('.wall__add').click();
await p.waitForTimeout(500);
const opt = await p
  .locator('#new-doc-domain option')
  .first()
  .evaluate((e) => {
    const s = getComputedStyle(e);
    return { bg: s.backgroundColor, color: s.color };
  });
console.log('option style:', JSON.stringify(opt));
check(
  'options have an opaque background',
  !/rgba\(.*0\)$/.test(opt.bg) && opt.bg !== 'rgba(0, 0, 0, 0)',
  opt.bg,
);
check(
  'option text is not the same as its background',
  opt.bg !== opt.color,
  `${opt.bg} vs ${opt.color}`,
);
await p.close();

await b.close();
console.log(`\nPASS ${pass.length}`);
pass.forEach((x) => console.log('  ✓ ' + x));
if (fail.length) {
  console.log(`\nFAIL ${fail.length}`);
  fail.forEach((x) => console.log('  ✗ ' + x));
  process.exit(1);
}
console.log('\nAll checks passed.');
