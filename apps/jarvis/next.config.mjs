import path from 'node:path';
import { fileURLToPath } from 'node:url';

const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: monorepoRoot,
  async headers() {
    return [
      {
        // Required so getUserMedia (mic) is allowed when this is embedded/opened cross-origin as an installed PWA.
        source: '/(.*)',
        headers: [{ key: 'Permissions-Policy', value: 'microphone=(self)' }],
      },
    ];
  },
};

export default nextConfig;
