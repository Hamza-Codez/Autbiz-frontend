import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';
let backendOrigin = process.env.BACKEND_ORIGIN;

if (isProd && !backendOrigin) {
  throw new Error("BACKEND_ORIGIN must be set in production");
}

// Defensively strip trailing slashes
if (backendOrigin && backendOrigin.endsWith('/')) {
  backendOrigin = backendOrigin.slice(0, -1);
}

const nextConfig: NextConfig = {
  async rewrites() {
    if (!backendOrigin) {
      return [];
    }
    return [
      {
        source: '/api/:path*',
        destination: `${backendOrigin}/:path*`,
      },
    ];
  },
};

export default nextConfig;
