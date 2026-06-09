import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── Compiler optimisations ──────────────────────────────────────────────────
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,

  // ── Package import shaking ───────────────────────────────────────────────────
  // Prevents entire barrel exports from being bundled; only the icons/components
  // actually used get shipped. Saves ~40-60 KB gzipped on every page.
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "sonner",
    ],
  },

  // ── Image optimisation ──────────────────────────────────────────────────────
  images: {
    formats: ["image/avif", "image/webp"], // serve AVIF first, WebP fallback
    minimumCacheTTL: 60 * 60 * 24 * 7,    // cache optimised images 7 days
    deviceSizes: [390, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    remotePatterns: [
      { protocol: "https", hostname: "ik.imagekit.io" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.cloudinary.com" },
    ],
  },

  // ── HTTP headers ────────────────────────────────────────────────────────────
  async headers() {
    return [
      {
        // Cache static assets aggressively (hashed filenames = safe to cache forever)
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // Cache public images / fonts / icons for 1 week
        source: "/:path*\\.(ico|png|jpg|jpeg|svg|webp|avif|woff2|woff)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" },
        ],
      },
      {
        // Security headers on every HTML response
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
