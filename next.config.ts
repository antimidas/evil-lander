import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "3evils.com" }],
        destination: "https://www.3evils.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
