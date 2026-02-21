import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow dev requests from local HTTPS domains (via Caddy)
  allowedDevOrigins: [
    'www.local.ironscout.ai',
  ],
  // Static export for maximum performance
  output: 'export',
  // Generate nested index.html (e.g. caliber/9mm/index.html) for clean URLs
  trailingSlash: true,

  // Image optimization disabled for static export
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
