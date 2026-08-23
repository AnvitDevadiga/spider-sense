import { Clock, Radio } from "lucide-react";

export default function SkeletonLoader() {
  return (
    <div className="flex flex-col flex-1 justify-between py-2 relative select-none">
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="relative w-28 h-28 rounded-2xl bg-black/80 border border-white/10 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,42,84,0.15),transparent_70%)] animate-pulse" />
          <span className="text-3xl animate-bounce">🕷️</span>
          <div className="absolute bottom-1.5 text-[8px] font-mono text-spidey-pop uppercase tracking-widest font-bold">
            CYBER SCANNING
          </div>
        </div>

        <div className="w-full space-y-2 px-2">
          <div className="h-3.5 bg-white/[0.08] rounded-md w-4/5 mx-auto animate-pulse" />
          <div className="h-3 bg-white/[0.05] rounded-md w-3/5 mx-auto animate-pulse" />
        </div>

        <div className="w-full py-2 flex flex-col items-center">
          <div className="h-9 bg-spidey-pop/10 border border-spidey-pop/20 rounded-xl w-32 animate-pulse flex items-center justify-center">
            <span className="text-xs font-mono text-spidey-pop/70 font-bold">
              $—.—
            </span>
          </div>
          <span className="text-[10px] font-mono text-gray-400 mt-2 flex items-center gap-1">
            <Clock className="w-3 h-3 animate-spin text-spidey-cyan" />
            Bright Data Web Unlocker...
          </span>
        </div>
      </div>

      <div className="space-y-2 pt-6 border-t border-white/[0.06] mt-4">
        <div className="h-9 bg-white/[0.04] border border-white/[0.06] rounded-xl w-full animate-pulse flex items-center justify-center">
          <span className="text-[10px] font-mono text-gray-500">
            Spider-bot extracting DOM...
          </span>
        </div>
        <div className="h-9 bg-white/[0.02] rounded-xl w-full animate-pulse" />
      </div>
    </div>
  );
}
