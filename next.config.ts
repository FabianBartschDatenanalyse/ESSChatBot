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
    // Fix for 'supports-color' issue with @tensorflow/tfjs
    if (!isServer) {
      config.resolve.alias['supports-color'] = false;
    }
    
    // Ensure node-pre-gyp is not bundled on the client
    config.externals.push('@mapbox/node-pre-gyp');

    return config;
  },
};

export default nextConfig;
