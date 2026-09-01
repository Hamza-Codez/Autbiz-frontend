/**
 * Guards on the proxy rewrite.
 *
 * Regression test. `next.config.ts` returned no rewrites at all when
 * `BACKEND_ORIGIN` was unset, and only threw when `NODE_ENV === 'production'`.
 * So `npm run dev` started cleanly, every `/api/*` call returned a Next.js 404
 * **HTML page**, and nothing anywhere said why.
 *
 * That is the exact symptom `rules.md` §29 tells you to look for *after a
 * deploy* — "if HTML is returned, the proxy rewrite failed" — so a missing local
 * variable presented as a deployment fault. Login simply did not work, with a
 * 200 from the backend and a 404 from the proxy.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL = process.env.BACKEND_ORIGIN;

async function loadConfig() {
  vi.resetModules();
  const mod = await import('../next.config');
  return mod.default;
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.BACKEND_ORIGIN;
  else process.env.BACKEND_ORIGIN = ORIGINAL;
  vi.restoreAllMocks();
});

describe('proxy rewrite', () => {
  it('still rewrites /api when BACKEND_ORIGIN is unset in development', async () => {
    delete process.env.BACKEND_ORIGIN;

    const config = await loadConfig();
    const rewrites = await config.rewrites!();

    // An empty array here is the defect: it fails silently and every API call
    // 404s with HTML.
    expect(Array.isArray(rewrites) ? rewrites : []).toHaveLength(1);
    const rule = (rewrites as { source: string; destination: string }[])[0];
    expect(rule.source).toBe('/api/:path*');
    expect(rule.destination).toBe('http://localhost:8000/:path*');
  });

  it('uses BACKEND_ORIGIN when it is set', async () => {
    process.env.BACKEND_ORIGIN = 'https://api.example.com';

    const config = await loadConfig();
    const rewrites = (await config.rewrites!()) as { destination: string }[];

    expect(rewrites[0].destination).toBe('https://api.example.com/:path*');
  });

  it('strips a trailing slash, which a pasted origin usually carries', async () => {
    // Without this the doubled path 404s in a way that points nowhere near the
    // cause.
    process.env.BACKEND_ORIGIN = 'https://api.example.com/';

    const config = await loadConfig();
    const rewrites = (await config.rewrites!()) as { destination: string }[];

    expect(rewrites[0].destination).toBe('https://api.example.com/:path*');
  });
});
