import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://velto.in";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/menu", "/subscription", "/become-a-rider", "/become-a-rider/apply"],
        disallow: [
          "/admin",
          "/admin/*",
          "/kitchen",
          "/kitchen/*",
          "/rider",
          "/rider/*",
          "/profile",
          "/profile/*",
          "/orders",
          "/orders/*",
          "/login",
          "/api/*",
        ],
      },
      {
        // Block AI scrapers and content scrapers
        userAgent: ["GPTBot", "CCBot", "anthropic-ai", "ChatGPT-User"],
        disallow: ["/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
