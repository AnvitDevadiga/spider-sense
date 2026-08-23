export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-white/[0.06] border border-white/[0.04] relative overflow-hidden ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent animate-[shimmer_2s_infinite]" />
    </div>
  );
}

export function SkeletonCardGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="cyber-laser-scanner glass-card rounded-2xl p-5 space-y-4 bg-black/60 border-white/10"
        >
          <div className="flex justify-between items-center">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="relative h-36 w-full rounded-xl bg-black/50 border border-white/5 flex items-center justify-center">
            <span className="text-2xl animate-pulse">🕷️</span>
          </div>
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-8 w-1/2" />
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Skeleton className="h-9 rounded-xl" />
            <Skeleton className="h-9 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}
