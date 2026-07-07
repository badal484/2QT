import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Restaurant Portal — 2QT",
  robots: { index: false, follow: false },
};

export default function RestaurantLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
