import type { Metadata } from "next";
import Script from "next/script";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://velto.in";

export const metadata: Metadata = {
  title: "Order Food Online — Bengaluru's Premium Gourmet Menu",
  description:
    "Browse VELTO's chef-crafted menu — biryanis, curries, healthy bowls, desserts and more. Fresh daily, delivered in 30 minutes across Bengaluru.",
  keywords: [
    "order food online Bengaluru",
    "gourmet menu Bangalore",
    "biryani delivery Bengaluru",
    "healthy food delivery Bangalore",
    "online food ordering",
    "meal delivery near me Bengaluru",
  ],
  alternates: { canonical: `${SITE_URL}/menu` },
  openGraph: {
    title: "VELTO Menu — Gourmet Delivery in 30 Min",
    description:
      "Chef-crafted meals delivered fresh to your door. Biryanis, curries, healthy bowls and more.",
    url: `${SITE_URL}/menu`,
    images: [{ url: "/og-menu.jpg", width: 1200, height: 630, alt: "VELTO Gourmet Menu" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "VELTO Menu — Gourmet Delivery in 30 Min",
    description: "Chef-crafted meals delivered fresh to your door.",
    images: ["/og-menu.jpg"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FoodEstablishment",
  name: "VELTO Food Palace",
  description: "Premium gourmet food delivery in Bengaluru",
  url: SITE_URL,
  servesCuisine: ["Indian", "Continental", "Healthy"],
  hasMenu: `${SITE_URL}/menu`,
  priceRange: "₹₹",
  areaServed: {
    "@type": "City",
    name: "Bengaluru",
  },
  address: {
    "@type": "PostalAddress",
    addressLocality: "Bengaluru",
    addressRegion: "Karnataka",
    addressCountry: "IN",
  },
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
    opens: "10:00",
    closes: "22:00",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    reviewCount: "1200",
  },
};

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script
        id="menu-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
