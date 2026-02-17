import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow dev requests from local HTTPS domains (via Caddy)
  allowedDevOrigins: [
    'www.local.ironscout.ai',
  ],
  // Static export for maximum performance
  output: 'export',

  // Image optimization disabled for static export
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
