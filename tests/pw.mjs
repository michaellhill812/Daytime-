/**
 * Where Playwright and the screenshots live.
 *
 * Playwright is not a project dependency — it is installed globally in the
 * container these suites were written in, and pulling it into package.json
 * would put a ~300MB browser download in front of anyone who only wants to
 * build the app. So: try the normal resolution first, fall back to the known
 * global path, and say something useful if neither works.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const candidates = [
  process.env.PLAYWRIGHT_MODULE,
  'playwright',
  '/opt/node22/lib/node_modules/playwright/index.mjs',
].filter(Boolean);

async function load() {
  const tried = [];
  for (const spec of candidates) {
    try {
      return await import(spec);
    } catch {
      tried.push(spec);
    }
  }
  throw new Error(
    `Playwright not found. Tried: ${tried.join(', ')}. Install it (npm i -g playwright) ` +
      `or point PLAYWRIGHT_MODULE at its entry file.`,
  );
}

const playwright = await load();
export const chromium = playwright.chromium ?? playwright.default.chromium;

/** Screenshots go here. Gitignored — they are evidence for one run, not source. */
export const OUT = process.env.DAYTIME_TEST_OUT ?? join(here, '.out');
mkdirSync(OUT, { recursive: true });

/** The app under test, built and served by tests/run.sh. */
export const APP = process.env.DAYTIME_TEST_URL ?? 'http://127.0.0.1:4321';

/** The sign-in / identity harness, from tests/harness. */
export const HARNESS = process.env.DAYTIME_HARNESS_URL ?? 'http://127.0.0.1:4400';

/** Tally that prints the way every suite here has always printed. */
export function tally() {
  const pass = [];
  const fail = [];
  return {
    pass,
    fail,
    check: (name, ok, detail = '') => (ok ? pass : fail).push(name + (detail ? ` — ${detail}` : '')),
    report() {
      console.log(`\nPASS ${pass.length}`);
      for (const p of pass) console.log('  ✓ ' + p);
      if (fail.length) {
        console.log(`\nFAIL ${fail.length}`);
        for (const f of fail) console.log('  ✗ ' + f);
        process.exit(1);
      }
      console.log('\nAll checks passed.');
    },
  };
}
