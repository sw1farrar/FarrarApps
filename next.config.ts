import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep recently visited pages warm so sidebar hops feel instant.
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
  },
  async redirects() {
    return [
      {
        source: "/transactions",
        destination: "/finance/transactions",
        permanent: true,
      },
      {
        source: "/reports",
        destination: "/finance/reports",
        permanent: true,
      },
      {
        source: "/invoices",
        destination: "/finance/invoices",
        permanent: true,
      },
      {
        source: "/invoices/:path*",
        destination: "/finance/invoices/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
