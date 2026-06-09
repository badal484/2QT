import type { Metadata } from "next";
import Script from "next/script";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://velto.in";

export const metadata: Metadata = {
  title: "Become a Delivery Partner — Earn with VELTO in Bengaluru",
  description:
    "Join VELTO's fleet of delivery partners in Bengaluru. Flexible hours, weekly payouts, and earn ₹25,000+ per month. Apply now and start riding with us.",
  keywords: [
    "delivery job Bengaluru",
    "delivery partner Bangalore",
    "earn money delivery Bengaluru",
    "bike delivery job Bangalore",
    "food delivery rider job",
    "flexible delivery work Bengaluru",
    "part time delivery job Bangalore",
  ],
  alternates: { canonical: `${SITE_URL}/become-a-rider` },
  openGraph: {
    title: "Become a VELTO Delivery Partner — Earn in Bengaluru",
    description:
      "Flexible hours, weekly payouts. Earn ₹25,000+ per month as a VELTO delivery partner.",
    url: `${SITE_URL}/become-a-rider`,
    images: [{ url: "/og-rider.jpg", width: 1200, height: 630, alt: "Become a VELTO Delivery Partner" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Become a VELTO Delivery Partner",
    description: "Flexible hours · Weekly payouts · Earn ₹25,000+/month",
    images: ["/og-rider.jpg"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "JobPosting",
  title: "Delivery Partner",
  description:
    "Join VELTO Food Palace as a delivery partner in Bengaluru. Flexible working hours and competitive earnings.",
  hiringOrganization: {
    "@type": "Organization",
    name: "VELTO Food Palace",
    sameAs: SITE_URL,
  },
  jobLocation: {
    "@type": "Place",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Bengaluru",
      addressRegion: "Karnataka",
      addressCountry: "IN",
    },
  },
  employmentType: "CONTRACTOR",
  baseSalary: {
    "@type": "MonetaryAmount",
    currency: "INR",
    value: {
      "@type": "QuantitativeValue",
      minValue: 15000,
      maxValue: 30000,
      unitText: "MONTH",
    },
  },
  datePosted: new Date().toISOString().split("T")[0],
};

export default function BecomeARiderLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script
        id="rider-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
