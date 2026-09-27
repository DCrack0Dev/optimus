/** @type {import('next').NextConfig} */
const optimusNextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: [
        "http://localhost:3001",
        "https://optimus.demitechwebservices.live"
      ]
    }
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "**.gravatar.com" }
    ]
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none';"
          }
        ]
      }
    ];
  },
  async redirects() {
    return [
      { source: "/admin.html", destination: "/login", permanent: true },
      { source: "/dashboard.html", destination: "/dashboard/command", permanent: true }
    ];
  }
};

export default optimusNextConfig;
