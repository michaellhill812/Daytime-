import { chromium, OUT, APP, HARNESS } from './pw.mjs';

// Desktop-sized, because the whole hypothesis is that cost scales with area.
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`${APP}/`);
await page.waitForTimeout(1200);

const client = await page.context().newCDPSession(page);

/** Frames the compositor actually produced over `ms`, via rAF deltas. */
async function sample(label, ms = 4000) {
  const res = await page.evaluate(async (duration) => {
    const deltas = [];
    let last = performance.now();
    await new Promise((done) => {
      const start = last;
      const tick = (t) => {
        deltas.push(t - last);
        last = t;
        if (t - start < duration) requestAnimationFrame(tick);
        else done();
      };
      requestAnimationFrame(tick);
    });
    deltas.shift();
    const sorted = [...deltas].sort((a, b) => a - b);
    const mean = deltas.reduce((s, d) => s + d, 0) / deltas.length;
    return {
      frames: deltas.length,
      meanMs: +mean.toFixed(2),
      p95Ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
      worstMs: +sorted[sorted.length - 1].toFixed(2),
      janky: deltas.filter((d) => d > 20).length,
    };
  }, ms);
  console.log(
    `${label.padEnd(22)} ${String(res.frames).padStart(4)} frames  ` +
      `mean ${String(res.meanMs).padStart(6)}ms  p95 ${String(res.p95Ms).padStart(6)}ms  ` +
      `worst ${String(res.worstMs).padStart(7)}ms  janky ${res.janky}`,
  );
  return res;
}

await sample('wheel idle');

// Switching views is where "framey" would be felt.
await page.getByRole('button', { name: 'World', exact: true }).click();
await page.waitForTimeout(900);
await sample('world open');

await page.getByRole('button', { name: 'Wall', exact: true }).click();
await page.waitForTimeout(900);
await sample('wall');

// How much of it is the aurora? Kill it and re-measure the same view.
await page.getByRole('button', { name: 'Wheel', exact: true }).click();
await page.waitForTimeout(700);
await page.evaluate(() => {
  const el = document.querySelector('.app__aurora');
  if (el) el.style.display = 'none';
});
await page.waitForTimeout(400);
await sample('wheel, aurora off');

await client.detach();
await browser.close();
