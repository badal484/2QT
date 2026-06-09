import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://2qt.in";
const SITE_NAME = "2QT";
const SITE_DESC =
  "Premium gourmet food delivered in 30 minutes across Bengaluru. Fresh ingredients, chef-crafted recipes, zero compromises.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Gourmet Delivery in Bengaluru`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESC,
  keywords: [
    "food delivery Bengaluru",
    "gourmet food delivery",
    "online food order Bangalore",
    "premium meal delivery",
    "chef crafted food Bangalore",
    "fast food delivery 30 minutes",
    "meal subscription Bangalore",
    "2QT food",
  ],
  authors: [{ name: "2QT", url: SITE_URL }],
  creator: "2QT",
  publisher: "2QT",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Gourmet Delivery in Bengaluru`,
    description: SITE_DESC,
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "2QT — Premium Gourmet Delivery",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Gourmet Delivery in Bengaluru`,
    description: SITE_DESC,
    images: ["/og-image.jpg"],
    creator: "@2qt_food",
  },
  alternates: {
    canonical: SITE_URL,
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.json",
  category: "food",
};

export const viewport: Viewport = {
  themeColor: "#FF6B35",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`h-full antialiased ${inter.variable} ${outfit.variable}`}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="2QT" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://checkout.razorpay.com" />
      </head>
      <body className="min-h-full flex flex-col bg-white text-zinc-900 selection:bg-swish-green/20">
        <Script
          id="org-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "2QT",
              url: SITE_URL,
              logo: `${SITE_URL}/icon-512x512.png`,
              description: SITE_DESC,
              areaServed: { "@type": "City", name: "Bengaluru" },
              contactPoint: {
                "@type": "ContactPoint",
                telephone: "+91-886-700-0000",
                contactType: "customer service",
                availableLanguage: ["English", "Kannada", "Hindi"],
              },
              sameAs: [
                "https://instagram.com/2qt_food",
                "https://twitter.com/2qt_food",
              ],
            }),
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
