// Reusable skeleton shimmer primitives — compose these in any tab/page

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-white/[0.06] rounded-xl ${className}`} />
  );
}

// Generic list row: icon box + two text lines + right value
export function SkeletonListRow() {
  return (
    <div className="flex items-center gap-4 bg-white/[0.03] border border-white/5 rounded-2xl p-4">
      <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-2.5 w-2/5" />
      </div>
      <Skeleton className="h-3.5 w-14 rounded-lg" />
    </div>
  );
}

// Order card: header row + divider + bottom tags
export function SkeletonOrderCard() {
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="h-2.5 w-1/3" />
        </div>
        <Skeleton className="h-6 w-16 rounded-lg" />
      </div>
      <div className="border-t border-white/5" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-20 rounded-lg" />
        <Skeleton className="h-6 w-16 rounded-lg" />
      </div>
    </div>
  );
}

// Stat card: icon + big number + label
export function SkeletonStatCard() {
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 space-y-3">
      <Skeleton className="w-10 h-10 rounded-xl" />
      <Skeleton className="h-7 w-3/5" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}

// Table row (finance / transactions)
export function SkeletonTableRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-white/5">
      <Skeleton className="h-3 w-24 rounded-lg" />
      <Skeleton className="h-3 w-32 rounded-lg flex-1" />
      <Skeleton className="h-3 w-16 rounded-lg" />
      <Skeleton className="h-5 w-14 rounded-full" />
    </div>
  );
}

// Full-screen list of N rows
export function SkeletonList({
  rows = 6,
  item,
}: {
  rows?: number;
  item?: React.ReactNode;
}) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i}>{item ?? <SkeletonListRow />}</div>
      ))}
    </div>
  );
}

// Dashboard: stat cards row + list
export function SkeletonDashboard({ stats = 4, rows = 5 }: { stats?: number; rows?: number }) {
  return (
    <div className="space-y-4 p-4">
      <div className={`grid grid-cols-2 md:grid-cols-${stats} gap-4`}>
        {Array.from({ length: stats }).map((_, i) => <SkeletonStatCard key={i} />)}
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => <SkeletonOrderCard key={i} />)}
      </div>
    </div>
  );
}
