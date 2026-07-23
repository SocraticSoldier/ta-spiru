import path from 'node:path';
import { fileURLToPath } from 'node:url';

const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@ta-spiru/shared'],
  output: 'standalone',
  outputFileTracingRoot: monorepoRoot,
};

export default nextConfig;
