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
    // Fix for 'supports-color' issue with @tensorflow/tfjs and other packages.
    if (!isServer) {
      config.resolve.alias['supports-color'] = false;
      // Provide a fallback for the problematic module on the client side.
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@mapbox/node-pre-gyp': false,
      };
    }

    return config;
  },
};

export default nextConfig;
