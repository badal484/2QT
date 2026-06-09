import type { Metadata } from "next";
import Script from "next/script";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://2qt.in";

export const metadata: Metadata = {
  title: "Become a Delivery Partner — Earn with 2QT in Bengaluru",
  description:
    "Join 2QT's fleet of delivery partners in Bengaluru. Flexible hours, weekly payouts, and earn ₹25,000+ per month. Apply now and start riding with us.",
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
    title: "Become a 2QT Delivery Partner — Earn in Bengaluru",
    description:
      "Flexible hours, weekly payouts. Earn ₹25,000+ per month as a 2QT delivery partner.",
    url: `${SITE_URL}/become-a-rider`,
    images: [{ url: "/og-rider.jpg", width: 1200, height: 630, alt: "Become a 2QT Delivery Partner" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Become a 2QT Delivery Partner",
    description: "Flexible hours · Weekly payouts · Earn ₹25,000+/month",
    images: ["/og-rider.jpg"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "JobPosting",
  title: "Delivery Partner",
  description:
    "Join 2QT as a delivery partner in Bengaluru. Flexible working hours and competitive earnings.",
  hiringOrganization: {
    "@type": "Organization",
    name: "2QT",
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
