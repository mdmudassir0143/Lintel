import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3', 'playwright-core', 'playwright'],
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
