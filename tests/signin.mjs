import { chromium, OUT, APP, HARNESS } from './pw.mjs';

const pass = [];
const fail = [];
const check = (n, ok, d = '') => (ok ? pass : fail).push(n + (d ? ` — ${d}` : ''));
const browser = await chromium.launch();

async function open(query = '') {
  const p = await browser.newPage({ viewport: { width: 390, height: 760 } });
  p.on('pageerror', (e) => fail.push(`pageerror: ${e.message}`));
  await p.goto(`${HARNESS}/signin.html${query}`);
  await p.waitForTimeout(350);
  return p;
}

// The happy path: the button is there and asks Supabase for Google.
{
  const p = await open();
  const btn = p.locator('.btn--google');
  check('the Google button is offered', await btn.isVisible());
  check(
    'email sign-in is still offered alongside it',
    await p.locator('input[type="email"]').isVisible(),
  );
  await p.screenshot({ path: `${OUT}/signin-google.png` });

  await btn.click();
  await p.waitForTimeout(300);
  const call = await p.evaluate(() => window.__calls.find((c) => c.fn === 'signInWithOAuth'));
  check(
    'it asks for the google provider',
    call?.args?.provider === 'google',
    JSON.stringify(call?.args),
  );
  check(
    'it sends the browser back to this origin',
    call?.args?.options?.redirectTo === HARNESS,
    call?.args?.options?.redirectTo,
  );
  check('the button reports it is working', (await btn.textContent())?.includes('Opening Google'));
  await p.close();
}

// The likeliest setup mistake: the provider was never switched on.
{
  const p = await open('?oauth=disabled');
  await p.locator('.btn--google').click();
  await p.waitForTimeout(350);
  const msg = (await p.locator('.gate__error').textContent())?.trim();
  check(
    'a disabled provider explains itself',
    /isn’t switched on/i.test(msg ?? ''),
    msg ?? '(none)',
  );
  check('and it names where to fix it', /Providers/i.test(msg ?? ''));
  check('the button becomes usable again', !(await p.locator('.btn--google').isDisabled()));
  await p.close();
}

// Any other provider failure is reported verbatim rather than swallowed.
{
  const p = await open('?oauth=other');
  await p.locator('.btn--google').click();
  await p.waitForTimeout(350);
  const msg = (await p.locator('.gate__error').textContent())?.trim();
  check('an unknown provider failure is surfaced', msg === 'Something else broke', msg ?? '(none)');
  await p.close();
}

// An OAuth error coming back in the URL must not advise typing an email code.
{
  const p = await open('?error=access_denied&error_description=You+cancelled+the+sign-in');
  await p.waitForTimeout(300);
  const msg = (await p.locator('.gate__error').textContent())?.trim();
  check(
    'a returned OAuth error is shown',
    /cancelled the sign-in/i.test(msg ?? ''),
    msg ?? '(none)',
  );
  check(
    'it does not tell you to type an emailed code',
    !/code from the email/i.test(msg ?? ''),
    msg ?? '',
  );
  const url = p.url();
  check('the error is stripped from the URL', !url.includes('error='), url);
  await p.close();
}

// A genuine expired-link error should still give the email advice.
{
  const p = await open(
    '?error=access_denied&error_description=Email+link+is+invalid+or+has+expired',
  );
  await p.waitForTimeout(300);
  const msg = (await p.locator('.gate__error').textContent())?.trim();
  check(
    'an expired link still advises the code',
    /code from the email/i.test(msg ?? ''),
    msg ?? '(none)',
  );
  await p.close();
}

// The email code flow must be untouched by all this.
{
  const p = await open();
  await p.fill('input[type="email"]', 'michael@example.com');
  await p.getByRole('button', { name: 'Send code' }).click();
  await p.waitForTimeout(300);
  check('the code screen still appears', await p.locator('.field--code').isVisible());
  check('Google is not offered mid-code-entry', (await p.locator('.btn--google').count()) === 0);
  await p.fill('.field--code', '123456');
  await p.getByRole('button', { name: 'Verify' }).click();
  await p.waitForTimeout(350);
  check('the emailed code still signs in', await p.evaluate(() => window.__verified));
  await p.close();
}

// Code length is a project setting, 6 to 10 digits, and unreadable from here.
// Hardcoding 6 once truncated an 8-digit code so it could never verify.
{
  const p = await open();
  await p.fill('input[type="email"]', 'michael@example.com');
  await p.getByRole('button', { name: 'Send code' }).click();
  await p.waitForTimeout(300);
  const verify = p.getByRole('button', { name: 'Verify' });

  await p.fill('.field--code', '12345');
  check('five digits is not enough to verify', await verify.isDisabled());
  await p.fill('.field--code', '123456');
  check('six digits is enough', !(await verify.isDisabled()));

  await p.fill('.field--code', '12ab345678cd90');
  const typed = await p.locator('.field--code').inputValue();
  check('letters are stripped and ten digits survive', typed === '1234567890', typed);

  await verify.click();
  await p.waitForTimeout(350);
  const sent = await p.evaluate(() => window.__calls.at(-1));
  check(
    'the whole ten-digit code reaches Supabase',
    sent?.args?.token === '1234567890',
    sent?.args?.token,
  );
  await p.close();
}

// An address Supabase already knows answers to type 'magiclink' and rejects
// 'email' with the same wording as a wrong code. The retry has to be silent.
{
  const p = await open('?verify=type');
  await p.fill('input[type="email"]', 'known@example.com');
  await p.getByRole('button', { name: 'Send code' }).click();
  await p.waitForTimeout(300);
  await p.fill('.field--code', '123456');
  await p.getByRole('button', { name: 'Verify' }).click();
  await p.waitForTimeout(400);
  check('the token type falls back rather than failing', await p.evaluate(() => window.__verified));
  check(
    'and nothing is shown to the person about it',
    (await p.locator('.gate__error').count()) === 0,
  );
  const types = await p.evaluate(() =>
    window.__calls.filter((c) => c.fn === 'verifyOtp').map((c) => c.args.type),
  );
  check(
    'it tried email first, then magiclink',
    types.join(',') === 'email,magiclink',
    types.join(','),
  );
  await p.close();
}

// A send that fails must say so and leave the email screen usable.
{
  const p = await open('?send=fail');
  await p.fill('input[type="email"]', 'michael@example.com');
  await p.getByRole('button', { name: 'Send code' }).click();
  await p.waitForTimeout(350);
  const msg = (await p.locator('.gate__error').textContent())?.trim();
  check('a rate-limited send is reported', /60 seconds/i.test(msg ?? ''), msg ?? '(none)');
  check('it does not advance to the code screen', (await p.locator('.field--code').count()) === 0);
  check(
    'the send button is usable again',
    !(await p.getByRole('button', { name: 'Send code' }).isDisabled()),
  );
  await p.close();
}

// Layout: the button must not overflow a narrow phone.
{
  const p = await open();
  const card = await p.locator('.gate__card').boundingBox();
  const btn = await p.locator('.btn--google').boundingBox();
  check(
    'the Google button fits the card',
    btn.x >= card.x - 1 && btn.x + btn.width <= card.x + card.width + 1,
    `btn ${Math.round(btn.x)}..${Math.round(btn.x + btn.width)} card ${Math.round(card.x)}..${Math.round(card.x + card.width)}`,
  );
  const scrolls = await p.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  check('the page does not scroll sideways', !scrolls);
  await p.close();
}

await browser.close();
console.log(`\nPASS ${pass.length}`);
for (const p of pass) console.log('  ✓ ' + p);
if (fail.length) {
  console.log(`\nFAIL ${fail.length}`);
  for (const f of fail) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('\nAll checks passed.');
