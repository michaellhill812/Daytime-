import { chromium, OUT, APP, HARNESS } from './pw.mjs';
const pass=[],fail=[];
const check=(n,ok,d='')=>(ok?pass:fail).push(n+(d?` — ${d}`:''));
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
p.on('pageerror', e=>fail.push('pageerror: '+e.message));
await p.goto(`${APP}/`);
await p.waitForTimeout(900);

// Open the Work spoke and its first task.
await p.locator('.spoke__hit').first().click();
await p.waitForTimeout(600);
await p.getByRole('dialog').locator('.task__title').first().click();
await p.waitForTimeout(600);

const sheet = p.getByRole('dialog');
const wall = sheet.locator('.block').filter({ has: p.locator('.block__title', { hasText: 'From the Wall' }) });
check('the task sheet offers documents from the Wall', await wall.isVisible());

const chips = wall.locator('.chip--pick');
const n = await chips.count();
check('every document is offerable', n > 5, String(n));

// Seed data already links some docs; those must show as attached.
const preLinked = await wall.locator('.chip--pick.is-on').count();
check('existing links show as attached', preLinked > 0, String(preLinked));

// The first offered chip should be one already attached (ranking puts them first).
check('attached ones sort to the front',
  await chips.first().evaluate(e=>e.classList.contains('is-on')));

// Attach something new and confirm it sticks.
const off = wall.locator('.chip--pick:not(.is-on)').first();
const title = (await off.textContent()).trim();
await off.click();
await p.waitForTimeout(400);
const nowOn = wall.locator('.chip--pick.is-on', { hasText: title });
check(`attaching "${title}" marks it attached`, await nowOn.count() === 1);
check('the count went up', (await wall.locator('.chip--pick.is-on').count()) === preLinked + 1);

// It must show on the Wall card as a reference.
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
await p.getByRole('button',{name:'Wall',exact:true}).click();
await p.waitForTimeout(700);
const card = p.locator('.card').filter({ hasText: title }).first();
check('the Wall card now shows a reference count', (await card.locator('.card__refs').count()) === 1, title);

// And detaching reverses it.
await p.getByRole('button',{name:'Wheel',exact:true}).click();
await p.waitForTimeout(600);
await p.locator('.spoke__hit').first().click();
await p.waitForTimeout(600);
await p.getByRole('dialog').locator('.task__title').first().click();
await p.waitForTimeout(600);
const again = p.getByRole('dialog').locator('.block').filter({ has: p.locator('.block__title', { hasText: 'From the Wall' }) });
await again.locator('.chip--pick.is-on', { hasText: title }).first().click();
await p.waitForTimeout(400);
check('detaching removes it again',
  (await again.locator('.chip--pick.is-on', { hasText: title }).count()) === 0);

// Survives a reload.
await p.reload(); await p.waitForTimeout(1000);
await p.locator('.spoke__hit').first().click();
await p.waitForTimeout(600);
await p.getByRole('dialog').locator('.task__title').first().click();
await p.waitForTimeout(600);
const after = p.getByRole('dialog').locator('.block').filter({ has: p.locator('.block__title', { hasText: 'From the Wall' }) });
check('the detach persisted across a reload',
  (await after.locator('.chip--pick.is-on', { hasText: title }).count()) === 0);
await p.screenshot({ path:`${OUT}/attach.png` });

await b.close();
console.log(`\nPASS ${pass.length}`); pass.forEach(x=>console.log('  ✓ '+x));
if (fail.length){ console.log(`\nFAIL ${fail.length}`); fail.forEach(x=>console.log('  ✗ '+x)); process.exit(1);}
console.log('\nAll checks passed.');
