"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Star, RefreshCw, MessageSquare, ChefHat, Bike, User } from "lucide-react";
import { SkeletonList } from "../components/ui/Skeleton";
import { useSocketRefresh } from "../hooks/useSocketRefresh";

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          className={s <= Math.round(value) ? "text-amber-400 fill-amber-400" : "text-zinc-700 fill-zinc-700"}
        />
      ))}
    </span>
  );
}

function StatPill({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <div className="flex-1 bg-white/[0.03] border border-white/8 rounded-2xl p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={20} />
      </div>
      <div>
        <div className="text-2xl font-black text-white tracking-tight">{value}</div>
        <div className="text-xs text-zinc-500 font-semibold uppercase tracking-widest mt-0.5">{label}</div>
      </div>
    </div>
  );
}

const FILTER_OPTIONS = [
  { label: "All", value: "all" },
  { label: "5 ★", value: "5" },
  { label: "4 ★", value: "4" },
  { label: "3 ★", value: "3" },
  { label: "2 ★", value: "2" },
  { label: "1 ★", value: "1" },
  { label: "With comment", value: "comment" },
  { label: "Critical (≤2)", value: "critical" },
];

export function RatingsTab() {
  const [filter, setFilter] = useState("all");

  const { data, isLoading, refetch, isFetching } = useQuery<any>({
    queryKey: ["admin-ratings"],
    queryFn: () => api.get("/admin/feedback"),
    staleTime: 60_000,
  });
  useSocketRefresh(['new_feedback'], refetch);

  const all: any[] = data?.feedbacks ?? [];

  const filtered = all.filter((f) => {
    if (filter === "all") return true;
    if (filter === "comment") return !!f.comment?.trim();
    if (filter === "critical") return f.rating <= 2 || f.delivery_rating <= 2;
    return Math.round(f.rating) === parseInt(filter);
  });

  const ratingColor = (r: number) => {
    if (r >= 4) return "text-green-400";
    if (r >= 3) return "text-amber-400";
    return "text-red-400";
  };

  const ratingBg = (r: number) => {
    if (r >= 4) return "bg-green-500/10 border-green-500/20";
    if (r >= 3) return "bg-amber-500/10 border-amber-500/20";
    return "bg-red-500/10 border-red-500/20";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white mb-1">Ratings & Reviews</h2>
          <p className="text-zinc-400 text-sm font-medium">Customer feedback on food quality and delivery.</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-white text-sm font-bold transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Stat pills */}
      <div className="flex gap-4 flex-wrap">
        <StatPill
          label="Avg Food Rating"
          value={data ? `${data.averageRating} / 5` : "—"}
          icon={ChefHat}
          color="bg-amber-500/15 text-amber-400"
        />
        <StatPill
          label="Avg Delivery Rating"
          value={data ? `${data.averageDeliveryRating} / 5` : "—"}
          icon={Bike}
          color="bg-blue-500/15 text-blue-400"
        />
        <StatPill
          label="Total Reviews"
          value={data ? data.totalCount.toLocaleString("en-IN") : "—"}
          icon={MessageSquare}
          color="bg-zinc-500/15 text-zinc-400"
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              filter === opt.value
                ? opt.value === "critical"
                  ? "bg-red-500/20 border-red-500/40 text-red-400"
                  : "bg-amber-500/15 border-amber-500/30 text-amber-400"
                : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/8"
            }`}
          >
            {opt.label}
            {opt.value === "all" && data && (
              <span className="ml-1 opacity-60">{data.totalCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <SkeletonList rows={5} />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 bg-white/3 rounded-2xl border border-white/8">
          <Star size={36} className="text-zinc-700 mb-3" />
          <p className="text-zinc-400 font-bold text-sm">No reviews in this category</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((f, i) => (
            <div
              key={i}
              className={`rounded-2xl border p-4 ${
                f.rating <= 2 || f.delivery_rating <= 2
                  ? "bg-red-500/5 border-red-500/20"
                  : "bg-zinc-900/60 border-white/8"
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Rating badge */}
                <div className={`w-14 h-14 rounded-xl border flex flex-col items-center justify-center shrink-0 ${ratingBg(f.rating)}`}>
                  <span className={`text-xl font-black ${ratingColor(f.rating)}`}>{f.rating}</span>
                  <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">food</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <Stars value={f.rating} />
                    {f.delivery_rating != null && (
                      <span className="flex items-center gap-1 text-xs text-zinc-400">
                        <Bike size={11} className="text-blue-400" />
                        Delivery
                        <Stars value={f.delivery_rating} size={11} />
                        <span className={`font-bold ${ratingColor(f.delivery_rating)}`}>{f.delivery_rating}</span>
                      </span>
                    )}
                    <span className="ml-auto text-xs text-zinc-600">
                      {new Date(f.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  {f.comment && (
                    <p className="text-sm text-zinc-300 italic mb-2">"{f.comment}"</p>
                  )}

                  <div className="flex items-center gap-4 flex-wrap text-xs text-zinc-500">
                    {f.customer_name && (
                      <span className="flex items-center gap-1">
                        <User size={11} />
                        {f.customer_name}
                        {f.customer_phone && <span className="text-zinc-600">· {f.customer_phone}</span>}
                      </span>
                    )}
                    {f.kitchen_name && (
                      <span className="flex items-center gap-1">
                        <ChefHat size={11} />
                        {f.kitchen_name}
                      </span>
                    )}
                    {f.order_display_id && (
                      <span className="font-mono text-zinc-600">#{f.order_display_id}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
