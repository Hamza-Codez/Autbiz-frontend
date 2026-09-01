import createClient from 'openapi-fetch';
import type { paths } from './schema';

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )csrf_token=([^;]+)'));
  return match ? match[2] : null;
}

export const api = createClient<paths>({
  baseUrl: '/api',
});

api.use({
  onRequest({ request }) {
    const method = request.method.toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const token = getCsrfToken();
      if (token) {
        request.headers.set('X-CSRF-Token', token);
      }
    }
    return request;
  },
  onResponse({ response }) {
    // Global 401 handling: a session can expire mid-visit, and the app must not
    // sit half-authenticated making calls that all fail.
    if (response.status === 401) {
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        // A full document navigation, deliberately, and not router.push().
        // This module is not a component, so useRouter() is unavailable — but
        // more importantly the reload discards every piece of in-memory user
        // state. A client-side push would preserve React state belonging to a
        // session that no longer exists. The redirect is suppressed on /login
        // so it cannot loop.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = '/login';
      }
    }
    return response;
  }
});
