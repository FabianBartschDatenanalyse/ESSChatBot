/** @type {import('next').NextConfig} */

// Baue die CSP ohne Newlines/Kommentare:
const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "connect-src 'self' https: http: ws: wss:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data: https:",
  "worker-src 'self' blob:",
  // Iframes explizit erlauben:
  "frame-src 'self' https://firebasestorage.googleapis.com https://*.firebaseapp.com https://*.web.app",
  // Fallback für alte Browser:
  "child-src 'self' https://firebasestorage.googleapis.com https://*.firebaseapp.com https://*.web.app",
  // Wer DARF dich einbetten:
  "frame-ancestors *"
];
const csp = cspDirectives.join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  // X-Frame-Options absichtlich weggelassen – CSP frame-ancestors ist maßgeblich.
];

const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  serverExternalPackages: ['@resvg/resvg-js', 'sharp', 'canvas'],

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co', pathname: '/**' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com', pathname: '/**' },
    ],
  },

  webpack: (config, { isServer }) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    config.resolve.alias['supports-color'] = false;

    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        path: false,
      };
    }

    config.externals = config.externals || [];
    config.externals.push(/\.node$/);

    return config;
  },

  async headers() {
    return [
      {
        // alle Routen außer _next/ bekommen die Security-Header
        source: '/:path((?!_next/).*)',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
