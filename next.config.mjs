/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['mongodb'],
  },
  async headers() {
    return [
      {
        source: '/:path(logo\\.png|favicon\\.ico|icon-192\\.png|icon-512\\.png|apple-touch-icon\\.png)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
    ];
  },
};

export default nextConfig;
