import type { NextConfig } from "next";

const nextConfig: NextConfig = {

  async rewrites() {
    return [
      {
        // Any request to /api/* on the frontend domain
        // gets silently forwarded to the backend
        source: "/api/:path*",
        destination: `${process.env.BACKEND_URL}/api/:path*`,
      },
    ];
  },

};

export default nextConfig;
