import type { Metadata } from "next";
import Script from "next/script";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://velto.in";

export const metadata: Metadata = {
  title: "Meal Subscription Plans — Save Up to 30% on Gourmet Delivery",
  description:
    "Pre-pay for 20 or 30 meals and save big. Lunch and dinner subscription plans with priority delivery, free delivery fees, and chef-crafted gourmet food across Bengaluru.",
  keywords: [
    "meal subscription Bengaluru",
    "food subscription plan Bangalore",
    "monthly meal plan delivery",
    "lunch subscription Bengaluru",
    "dinner subscription Bangalore",
    "prepaid meal plan",
    "affordable gourmet delivery",
  ],
  alternates: { canonical: `${SITE_URL}/subscription` },
  openGraph: {
    title: "VELTO Meal Plans — Save 30% on Gourmet Delivery",
    description:
      "20 or 30-meal subscription plans with priority delivery. Lunch from ₹1,999 · Dinner from ₹2,199.",
    url: `${SITE_URL}/subscription`,
    images: [{ url: "/og-subscription.jpg", width: 1200, height: 630, alt: "VELTO Meal Subscription Plans" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "VELTO Meal Plans — Save 30% on Gourmet Delivery",
    description: "20 or 30-meal plans. Lunch from ₹1,999 · Dinner from ₹2,199.",
    images: ["/og-subscription.jpg"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "VELTO Meal Subscription Plans",
  description: "Pre-paid meal subscription plans for gourmet lunch and dinner delivery in Bengaluru",
  brand: { "@type": "Brand", name: "VELTO Food Palace" },
  offers: [
    {
      "@type": "Offer",
      name: "20 Lunch Plan",
      price: "1999",
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/subscription`,
    },
    {
      "@type": "Offer",
      name: "30 Lunch Plan",
      price: "2799",
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/subscription`,
    },
    {
      "@type": "Offer",
      name: "20 Dinner Plan",
      price: "2199",
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/subscription`,
    },
    {
      "@type": "Offer",
      name: "30 Dinner Plan",
      price: "2999",
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/subscription`,
    },
  ],
};

export default function SubscriptionLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script
        id="subscription-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
