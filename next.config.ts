import type { NextConfig } from 'next';

/**
 * The browser must only ever see one origin (rules.md §21). `/api/:path*` is
 * rewritten to the backend so cookies are attached automatically and no CORS
 * preflight is involved.
 *
 * `BACKEND_ORIGIN` is server-side only and read at BUILD time — changing it
 * requires a redeploy, not a restart.
 */

const isProd = process.env.NODE_ENV === 'production';

/**
 * Development falls back to the local backend.
 *
 * It previously returned no rewrites at all when the variable was unset, which
 * failed *silently*: `npm run dev` started fine, and every /api call returned a
 * Next.js 404 HTML page. Nothing pointed at the cause, and "HTML instead of
 * JSON" is precisely the symptom rules.md §29 tells you to look for after a
 * deploy — so the local failure mimicked a deployment fault.
 *
 * Production still refuses to build rather than defaulting. A build that stops
 * is a five-minute fix; one that ships pointing at localhost is an afternoon.
 */
const DEV_FALLBACK = 'http://localhost:8000';

let backendOrigin = process.env.BACKEND_ORIGIN;

if (!backendOrigin) {
  if (isProd) {
    throw new Error(
      'BACKEND_ORIGIN must be set in production. Set it for Production AND Preview — ' +
        '"works in Production, broken in Preview" is this variable, every time.',
    );
  }
  backendOrigin = DEV_FALLBACK;
}

// A pasted origin usually carries a trailing slash, and the doubled path 404s
// in a way that points nowhere near the cause.
backendOrigin = backendOrigin.replace(/\/+$/, '');

// Logged once, so the resolved value is visible in the dev server output rather
// than being something you infer from a 404.
console.log(`[next.config] /api/* -> ${backendOrigin}`);

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${backendOrigin}/:path*` }];
  },
};

export default nextConfig;
