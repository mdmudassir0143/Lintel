import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3', 'playwright-core', 'playwright'],
  outputFileTracingRoot: path.join(__dirname),
  devIndicators: false,
  async redirects() {
    return [
      { source: '/scan/:id', destination: '/app/scan/:id', permanent: false },
      { source: '/run/:id', destination: '/app/run/:id', permanent: false },
      { source: '/merchant/:id', destination: '/app/stores/:id', permanent: false },
    ];
  },
};

export default nextConfig;
