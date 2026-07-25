"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, UtensilsCrossed, Star, MapPin, Loader2, ChevronRight } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../providers";
import { Toaster } from "sonner";

export default function TableBookingLandingPage() {
  const { user, loading: authLoading } = useAuth()!;
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/login?redirect=/table-booking"); return; }
    if (user) {
      const cachedLoc = typeof window !== "undefined" ? localStorage.getItem("2qt_last_location") : null;
      let params = "";
      if (cachedLoc) {
        try { const { lat, lng } = JSON.parse(cachedLoc); params = `?lat=${lat}&lng=${lng}`; } catch {}
      }
      api.get(`/restaurants${params}`)
        .then((d: any) => setRestaurants(Array.isArray(d) ? d : d.restaurants ?? []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [user, authLoading, router]);

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-zinc-900 font-sans antialiased pb-20">
      <Toaster richColors position="top-center" />

      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-black/5 px-6 py-4 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/menu" className="text-zinc-500 hover:text-zinc-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-bold">Table Bookings</h1>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 pt-10">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-zinc-900 mb-2">Reserve a Table</h2>
          <p className="text-zinc-500 text-sm">Choose a restaurant and book your dining experience.</p>
        </div>

        {loading ? (
          <div className="grid gap-4">
            {[1,2,3].map(i => <div key={i} className="h-28 bg-white rounded-2xl animate-pulse shadow-sm" />)}
          </div>
        ) : restaurants.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-zinc-200 shadow-sm">
            <UtensilsCrossed className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-zinc-900 mb-2">No restaurants available</h3>
            <p className="text-zinc-500 text-sm">No restaurants found in your area right now.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {restaurants.map((r: any) => (
              <Link key={r.id} href={`/table-booking/${r.id}`}>
                <div className="bg-white rounded-2xl border border-zinc-200 p-5 flex gap-4 hover:border-brand-primary/40 hover:shadow-md transition-all cursor-pointer">
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-zinc-100 shrink-0">
                    {r.cover_photo || r.photo_url
                      ? <Image src={r.cover_photo || r.photo_url} alt={r.name} fill sizes="80px" className="object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><UtensilsCrossed className="w-6 h-6 text-zinc-300" /></div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-zinc-900 text-base mb-1">{r.name}</h3>
                    {r.cuisine && <p className="text-sm text-zinc-500 mb-1">{r.cuisine}</p>}
                    <div className="flex items-center gap-3 text-xs text-zinc-400">
                      {r.rating && (
                        <span className="flex items-center gap-1"><Star className="w-3 h-3 text-amber-400 fill-amber-400" /> {r.rating}</span>
                      )}
                      {r.address && (
                        <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3 shrink-0" /> {r.address}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-400 shrink-0 self-center" />
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link href="/my-table-bookings" className="text-sm font-semibold text-brand-primary hover:text-brand-dark transition-colors">
            View my bookings →
          </Link>
        </div>
      </main>
    </div>
  );
}
