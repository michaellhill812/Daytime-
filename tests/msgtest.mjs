import { chromium, OUT, APP, HARNESS } from './pw.mjs';

const pass = [];
const fail = [];
const check = (n, ok, d = '') => (ok ? pass : fail).push(n + (d ? ` — ${d}` : ''));

const browser = await chromium.launch();
// One context, so all three "people" share a localStorage document — that is
// what makes a note actually cross between them.
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });

async function as(email) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => fail.push(`pageerror: ${e.message}`));
  await p.goto(`${HARNESS}/people.html?me=${encodeURIComponent(email)}`);
  await p.waitForTimeout(500);
  return p;
}

const badge = async (p) => {
  const n = await p.locator('.bubble__count').count();
  return n === 0 ? 0 : Number((await p.locator('.bubble__count').textContent()).trim());
};

// ---- Michael writes one note to Leila only, and one to everyone ----------
{
  const p = await as('michael@example.com');
  check('the bubble is offered when there are other people', await p.locator('.bubble').isVisible());
  check('nothing is unread for the sender', (await badge(p)) === 0);

  await p.locator('.bubble').click();
  await p.waitForTimeout(400);
  // Everyone + the two other people. You are never in your own recipient
  // list, so a three-person workspace offers three chips, not four.
  const chips = await p.locator('.chip--pick').allTextContents();
  check('the composer offers Everyone plus each other person', chips.length === 3, chips.join(' / '));
  check('you are not offered as a recipient to yourself', !chips.some((t) => /Michael/i.test(t)), chips.join(' / '));
  check(
    'a member with no account name still appears by address',
    (await p.locator('.chip--pick').allTextContents()).some((t) => /andrew/i.test(t)),
    (await p.locator('.chip--pick').allTextContents()).join(' / '),
  );

  // Addressed to Leila alone.
  await p.locator('.chip--pick', { hasText: 'Leila Hill' }).click();
  await p.locator('.sheet input.field').fill('Just for Leila');
  await p.getByRole('button', { name: 'Send' }).click();
  await p.waitForTimeout(300);

  // Then one to everyone.
  await p.locator('.chip--pick', { hasText: 'Everyone' }).click();
  await p.locator('.sheet input.field').fill('For the whole workspace');
  await p.getByRole('button', { name: 'Send' }).click();
  await p.waitForTimeout(400);

  const bodies = await p.locator('.msg__body').allTextContents();
  check('the sender sees both of their notes', bodies.length === 2, bodies.join(' | '));
  check('own notes are styled as mine', (await p.locator('.msg--mine').count()) === 2);
  check('audience is named on the targeted note',
    (await p.locator('.msg', { hasText: 'Just for Leila' }).locator('.msg__to').textContent())?.includes('Leila'));
  check('audience reads Everyone on the broadcast',
    (await p.locator('.msg', { hasText: 'For the whole workspace' }).locator('.msg__to').textContent())?.includes('Everyone'));
  check('sending does not make your own note unread', (await badge(p)) === 0);
  await p.screenshot({ path: `${OUT}/msg-sender.png` });
  await p.close();
}

// ---- Leila should have two waiting -------------------------------------
{
  const p = await as('leila@example.com');
  check('the addressed recipient has both notes waiting', (await badge(p)) === 2, String(await badge(p)));

  await p.locator('.bubble').click();
  await p.waitForTimeout(500);
  const bodies = await p.locator('.msg__body').allTextContents();
  check('she can read the note addressed to her', bodies.includes('Just for Leila'));
  check('and the broadcast', bodies.includes('For the whole workspace'));
  check('neither is styled as hers', (await p.locator('.msg--mine').count()) === 0);
  check('opening clears the badge', (await badge(p)) === 0, String(await badge(p)));
  await p.screenshot({ path: `${OUT}/msg-recipient.png` });
  await p.close();
}

// ---- Andrew was only on the broadcast ----------------------------------
{
  const p = await as('andrew@example.com');
  check('a non-recipient sees only the broadcast waiting', (await badge(p)) === 1, String(await badge(p)));

  await p.locator('.bubble').click();
  await p.waitForTimeout(500);
  const bodies = await p.locator('.msg__body').allTextContents();
  check('the broadcast reaches him', bodies.includes('For the whole workspace'));
  check(
    'the note addressed to someone else is not shown to him',
    !bodies.includes('Just for Leila'),
    bodies.join(' | '),
  );
  await p.close();
}

// ---- Read state is on the message, so it follows to another device ------
{
  const p = await as('leila@example.com');
  check('read state follows the person, not the device', (await badge(p)) === 0, String(await badge(p)));
  await p.close();
}

await ctx.close();
await browser.close();

console.log(`\nPASS ${pass.length}`);
for (const p of pass) console.log('  ✓ ' + p);
if (fail.length) {
  console.log(`\nFAIL ${fail.length}`);
  for (const f of fail) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('\nAll checks passed.');
