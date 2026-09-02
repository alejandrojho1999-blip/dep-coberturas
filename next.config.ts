import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['217.216.92.14'],
  // `mammoth` y `pdf-parse` tocan el sistema de ficheros al cargarse: si el
  // bundler los empaqueta, se rompen en tiempo de ejecución.
  serverExternalPackages: ['yahoo-finance2', 'xlsx', 'mathjs', 'docx', 'mammoth', 'pdf-parse'],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
};

export default nextConfig;
