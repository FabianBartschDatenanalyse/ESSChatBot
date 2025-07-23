import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
   webpack: (config, { isServer }) => {
    // Fix for issues with Node.js-specific modules in the browser.
    if (!isServer) {
      // Provide fallbacks for Node.js-specific modules that are not available in the browser.
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@mapbox/node-pre-gyp': false, // Specifically exclude this problematic module
        'supports-color': false, // Another common issue
        'fs': false,
        'path': false,
        'os': false,
      };
    }

    return config;
  },
};

export default nextConfig;
