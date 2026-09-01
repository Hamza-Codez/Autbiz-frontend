/**
 * Rendered verification — measures COMPUTED styles, never class names.
 *
 * spec01-frontend §Rendered verification. A Tailwind class in the markup proves
 * nothing about what a person sees: the class may not exist, may be purged, or
 * may be overridden. Only the computed value is evidence.
 *
 * Run with both servers up:  node scratch/rendered-check.mjs
 */
import { chromium } from 'playwright';

const FRONTEND = 'http://localhost:3000';

/** WCAG relative luminance. */
function luminance([r, g, b]) {
  const a = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

/**
 * Resolve any CSS colour to RGB using the browser itself.
 *
 * Tailwind v4 emits oklch(), so getComputedStyle returns oklch strings that a
 * hand-written rgb() regex silently fails on. Painting the colour to a canvas
 * and reading the pixel back works for every notation the browser supports,
 * present and future.
 */
async function toRgb(page, cssColor) {
  return page.evaluate((color) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b];
  }, cssColor);
}

function contrast(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** Walk up for the first non-transparent background actually painted. */
async function effectiveBackground(locator) {
  return locator.evaluate((el) => {
    let node = el;
    while (node) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg && bg !== 'transparent' && !bg.startsWith('rgba(0, 0, 0, 0)')) return bg;
      node = node.parentElement;
    }
    return 'rgb(255, 255, 255)';
  });
}

const results = [];
async function record(page, label, fgRaw, bgRaw, min) {
  const fg = await toRgb(page, fgRaw);
  const bg = await toRgb(page, bgRaw);
  const ratio = contrast(fg, bg);
  const pass = ratio >= min;
  results.push({ label, fgRaw, bgRaw, ratio: ratio.toFixed(2), min, pass });
}

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto(`${FRONTEND}/login`, { waitUntil: 'networkidle' });

// Labels and heading.
for (const [label, selector, min] of [
  ['heading "Sign In"', 'h1', 3.0],
  ['label "Email"', 'label[for="email"]', 4.5],
  ['label "Password"', 'label[for="password"]', 4.5],
]) {
  const el = page.locator(selector).first();
  const color = await el.evaluate((n) => getComputedStyle(n).color);
  await record(page, label, color, await effectiveBackground(el), min);
}

// Typed input text — the classic invisible-text defect is white-on-white here.
const emailInput = page.locator('#email');
await emailInput.fill('someone@example.com');
await record(
  page,
  'typed input text',
  await emailInput.evaluate((n) => getComputedStyle(n).color),
  await effectiveBackground(emailInput),
  4.5,
);

// Trigger a real 401 so the error banner renders with its actual styles.
await page.locator('#password').fill('definitely-the-wrong-password');
await page.getByRole('button', { name: /sign in/i }).click();

const error = page.locator('text=Email or password is incorrect.').first();
await error.waitFor({ state: 'visible', timeout: 15000 });
await record(
  page,
  'error message (the 401 envelope text)',
  await error.evaluate((n) => getComputedStyle(n).color),
  await effectiveBackground(error),
  4.5,
);

// Disabled-in-flight is asserted in the component tests; here we only confirm
// the control is reachable and labelled in the real DOM.
const button = page.getByRole('button', { name: /sign in/i });
await record(
  page,
  'submit button',
  await button.evaluate((n) => getComputedStyle(n).color),
  await effectiveBackground(button),
  4.5,
);

let failed = 0;
console.log('\n  Computed-style contrast (WCAG AA: 4.5 body, 3.0 large)\n');
for (const r of results) {
  if (!r.pass) failed++;
  console.log(
    `  ${r.pass ? 'PASS' : 'FAIL'}  ${r.ratio.padStart(6)}:1  (min ${r.min})  ${r.label}\n` +
      `              fg ${r.fgRaw}  on  bg ${r.bgRaw}`,
  );
}
console.log(`\n  ${results.length - failed}/${results.length} passed\n`);
process.exit(failed > 0 ? 1 : 0);
