/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Allow building even with type errors during development
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        // Apply cache-busting headers to all API routes
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
          {
            key: 'Surrogate-Control',
            value: 'no-store',
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig
